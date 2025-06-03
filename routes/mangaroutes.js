const router = require('express').Router()
const User = require('../models/UserModel')
const moment = require('moment')
const momenttimezone = require('moment-timezone')
const Category = require('../models/CategoryModel')
const Manga = require('../models/MangaModel')
const Chapter = require('../models/ChapterModel')
const Payment = require('../models/PaymentModel')
const Notification = require('../models/NotifyModel')
const upload = require('./upload')

router.get('/mangas', async (req, res) => {
  try {
    const mangaList = await Manga.find({ isRead: true })
      .select('manganame image category chapters author view')
      .populate('chapters', 'number')
      .exec()
    const formattedMangaList = mangaList.map(manga => ({
      id: manga._id,
      manganame: manga.manganame,
      author: manga.author,
      image: manga.image,
      category: manga.category,
      totalChapters: manga.chapters.length,
      view: manga.view
    }))
    res.json(formattedMangaList)
  } catch (error) {
    console.error('Lỗi khi lấy danh sách truyện:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi lấy danh sách truyện' })
  }
})
router.post('/approvesuatruyen/:mangaId/:id', async (req, res) => {
  try {
    const mangaId = req.params.mangaId
    const id = req.params.id
    const manga = await Manga.findById(mangaId)

    if (!manga) {
      return res.status(404).json({ message: 'Không tìm thấy truyện.' })
    }

    if (manga.isApproved) {
      // Nếu truyện đã được duyệt, không thực hiện duyệt lại
      return res
        .status(400)
        .json({ message: 'Truyện đã được duyệt, không thể duyệt lại.' })
    }

    if (manga.pendingChanges) {
      // Nếu có thay đổi đang chờ, thực hiện cập nhật nội dung mới
      manga.manganame = manga.pendingChanges.manganame
      manga.author = manga.pendingChanges.author
      manga.content = manga.pendingChanges.content
      manga.category = manga.pendingChanges.category
      manga.view = manga.pendingChanges.view
      manga.like = manga.pendingChanges.like
      manga.image = manga.pendingChanges.image
    }

    // Cập nhật trạng thái duyệt và lưu truyện
    manga.isApproved = true
    manga.pendingChanges = undefined
    await manga.save()

    // Xóa thông báo chờ duyệt
    const notification = await Notification.findByIdAndDelete(id)

    // Tạo thông báo cho người sửa truyện
    const newNotification = new Notification({
      adminId: req.session.userId,
      title: 'Được phê duyệt',
      content: `Truyện ${manga.manganame} của bạn đã được duyệt và sửa thành công.`,
      userId: notification.userId,
      mangaId: mangaId
    })

    await newNotification.save()
    return res.render('successadmin', { message: 'Duyệt thành công' })
  } catch (error) {
    console.error('Lỗi duyệt truyện', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi duyệt truyện' })
  }
})
router.post('/huymanga/:mangaId/:id', async (req, res) => {
  try {
    const mangaId = req.params.mangaId
    const notifyId = req.params.id
    const { reason } = req.body
    const manga = await Manga.findByIdAndDelete(mangaId)
    const notify = await Notification.findByIdAndDelete(notifyId)

    const newNotification = new Notification({
      adminId: req.session.userId,
      title: 'Đã bị hủy',
      content: `Truyện ${manga.manganame} của bạn đã bị hủy - lí do: ${reason}.`,
      userId: notify.userId,
      mangaId: mangaId
    })
    await newNotification.save()

    return res.render('successadmin', { message: 'Hủy thêm truyện thành công' })
  } catch (error) {
    console.error('Lỗi duyệt truyện', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi duyệt truyện' })
  }
})
router.post('/huymangaput/:mangaId/:id', async (req, res) => {
  try {
    const mangaId = req.params.mangaId
    const notifyId = req.params.id
    const { reason } = req.body
    const manga = await Manga.findById(mangaId)
    const notify = await Notification.findByIdAndDelete(notifyId)
    manga.pendingChanges = undefined
    await manga.save()

    const newNotification = new Notification({
      adminId: req.session.userId,
      title: 'Đã bị hủy',
      content: `Truyện ${manga.manganame} của bạn đã bị hủy sửa - lí do: ${reason}.`,
      userId: notify.userId,
      mangaId: mangaId
    })
    await newNotification.save()

    return res.render('successadmin', { message: 'Hủy sửa truyện thành công' })
  } catch (error) {
    console.error('Lỗi duyệt truyện', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi duyệt truyện' })
  }
})

router.post('/mangapost', async (req, res) => {
  try {
    const userId = req.session.userId
    const { manganame, author, content, category, image } = req.body
    const categoryObject = await Category.findOne({ categoryname: category })
    const user = await User.findById(userId)
    if (!user) {
      return res.status(403).json({ message: 'user không tồn tại' })
    }

    if (!categoryObject) {
      return res.status(404).json({ message: 'Thể loại không tồn tại.' })
    }
    const manga = new Manga({
      userID: userId,
      manganame,
      author,
      content,
      category,
      image
    })

    if (user.role === 'nhomdich') {
      const notification = new Notification({
        adminId: '653a20c611295a22062661f9',
        title: 'Duyệt thêm truyện',
        content: `Truyện ${manganame} cần được duyệt.`,
        userId: userId,
        mangaId: manga._id
      })

      await notification.save()
      manga.view = 10
      manga.like = 0
      manga.link = `https://du-an-2023.vercel.app/manga/${manga._id}/chapters`
      manga.isRead = false
      await manga.save()
      categoryObject.manga.push(manga._id)
      await categoryObject.save()
      res.render('successnhomdich', {
        message: 'Truyện của bạn đã thêm thành công và đang đợi xét duyệt'
      })
    } else {
      manga.view = 10
      manga.like = 0
      manga.link = `https://du-an-2023.vercel.app/manga/${manga._id}/chapters`
      manga.isRead = true
      await manga.save()
      categoryObject.manga.push(manga._id)
      await categoryObject.save()
      res.render('successadmin', { message: 'Thêm truyện thành công' })
    }
  } catch (error) {
    console.error('Lỗi khi tạo truyện:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi tạo truyện' })
  }
})

router.post(
  '/mangapostnew/:userid',
  upload.fields([{ name: 'image', maxCount: 1 }]),
  async (req, res) => {
    try {
      const userId = req.params.userid
      const { manganame, author, content, category } = req.body
      const image = req.files['image']
        ? `http://localhost:8080/${req.files['image'][0].filename}`
        : null

      const categoryObject = await Category.findOne({ categoryname: category })
      const user = await User.findById(userId)
      if (!user) {
        return res.status(403).json({ message: 'user không tồn tại' })
      }

      if (!categoryObject) {
        return res.status(404).json({ message: 'Thể loại không tồn tại.' })
      }
      const manga = new Manga({
        userID: userId,
        manganame,
        author,
        content,
        category,
        image
      })

      if (user.role === 'nhomdich') {
        const notification = new Notification({
          adminId: '653a20c611295a22062661f9',
          title: 'Duyệt thêm truyện',
          content: `Truyện ${manganame} cần được duyệt.`,
          userId: userId,
          mangaId: manga._id
        })

        await notification.save()
        manga.view = 10
        manga.like = 0
        manga.link = `https://du-an-2023.vercel.app/manga/${manga._id}/chapters`
        manga.isRead = false
        await manga.save()
        categoryObject.manga.push(manga._id)
        await categoryObject.save()
        res.json({
          message:
            'Truyện của bạn vừa được thêm thành công và đang đợi xét duyệt'
        })
      } else {
        manga.view = 10
        manga.like = 0
        manga.link = `https://du-an-2023.vercel.app/manga/${manga._id}/chapters`
        manga.isRead = true
        await manga.save()
        categoryObject.manga.push(manga._id)
        await categoryObject.save()
        res.json({ message: 'thêm truyện thành công' })
      }
    } catch (error) {
      console.error('Lỗi khi tạo truyện:', error)
      res.status(500).json({ error: 'Đã xảy ra lỗi khi tạo truyện' })
    }
  }
)

router.post('/approveManga/:mangaId', async (req, res) => {
  try {
    const mangaId = req.params.mangaId

    // Tìm truyện dựa trên ID
    const manga = await Manga.findById(mangaId)

    if (!manga) {
      return res.status(404).send('Không tìm thấy truyện')
    }

    // Kiểm tra xem truyện đã được duyệt chưa, nếu chưa thì cập nhật trạng thái và lưu truyện
    if (!manga.isRead) {
      manga.isRead = true
      await manga.save()
      await Notification.deleteOne({ mangaId: mangaId })

      const newNotification = new Notification({
        adminId: req.session.userId, // Thay đổi đây thành adminId tương ứng
        title: 'Được phê duyệt',
        content: `Truyện ${manga.manganame} của bạn đã được duyệt và đăng thành công, giờ đây bạn có thể đăng chap của truyện.`,
        userId: manga.userID, // Thay đổi đây thành userId tương ứng với nhóm dịch
        mangaId: mangaId
      })

      await newNotification.save()
      return res.render('successadmin', { message: 'Duyệt thành công' })
    } else {
      return res.status(200).send('Truyện đã được duyệt trước đó')
    }
  } catch (error) {
    console.error('Lỗi khi duyệt truyện:', error)
    res.status(500).send('Đã xảy ra lỗi khi duyệt truyện')
  }
})

router.get('/manganotifi/:mangaId', async (req, res) => {
  try {
    const mangaId = req.params.mangaId

    const notification = await Notification.findOne({ mangaId })

    if (!notification) {
      return res
        .status(404)
        .json({ error: 'Không tìm thấy thông báo cho truyện này.' })
    }
    const mangaDetail = await Manga.findById(mangaId)

    if (!mangaDetail) {
      return res.status(404).json({ error: 'Không tìm thấy truyện chi tiết.' })
    }

    res.json({
      manganame: mangaDetail.manganame,
      title: notification.title,
      image: mangaDetail.image,
      content: mangaDetail.content,
      author: mangaDetail.author,
      category: mangaDetail.category
    })
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết truyện:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi lấy chi tiết truyện.' })
  }
})
router.get('/manganotifysua/:mangaId', async (req, res) => {
  try {
    const mangaId = req.params.mangaId

    const notification = await Notification.findOne({ mangaId })

    if (!notification) {
      return res
        .status(404)
        .json({ error: 'Không tìm thấy thông báo cho truyện này.' })
    }
    const mangaDetail = await Manga.findById(mangaId)

    if (!mangaDetail) {
      return res.status(404).json({ error: 'Không tìm thấy truyện chi tiết.' })
    }

    res.json(mangaDetail.pendingChanges)
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết truyện:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi lấy chi tiết truyện.' })
  }
})

router.post('/mangaput/:_id', async (req, res) => {
  try {
    const userId = req.session.userId
    const mangaId = req.params._id
    const { manganame, author, content, category, image, link } = req.body
    const user = await User.findById(userId)
    if (!user || typeof userId !== 'string') {
      console.log('Session:', req.session)
      return res.status(403).json({ message: 'Không có id.' })
    }

    const manga = await Manga.findById(mangaId)

    if (!manga) {
      return res.status(404).json({ message: 'Không tìm thấy truyện.' })
    }

    if (manga.category !== category) {
      const oldCategory = await Category.findOne({
        categoryname: manga.category
      })
      if (oldCategory) {
        oldCategory.manga = oldCategory.manga.filter(
          id => id.toString() !== mangaId
        )
        await oldCategory.save()
      }

      const newCategory = await Category.findOne({ categoryname: category })
      if (newCategory) {
        newCategory.manga.push(mangaId)
        await newCategory.save()
      }
    }

    if (user.role === 'nhomdich') {
      manga.pendingChanges = {
        manganame,
        author,
        content,
        category,
        image,
        link
      }
      manga.isApproved = false
      const notification = new Notification({
        adminId: '653a20c611295a22062661f9',
        title: 'Duyệt sửa truyện',
        content: ` Truyện ${manganame} cần được duyệt để sửa .`,
        userId: userId,
        mangaId: manga._id,
        isRead: false
      })
      await Promise.all([manga.save(), notification.save()])
      res.render('successnhomdich', {
        message: 'Truyện của bạn vừa được sửa và đang đợi duyệt'
      })
    } else {
      manga.pendingChanges = undefined
      manga.isApproved = true
      manga.manganame = manganame
      manga.author = author
      manga.content = content
      manga.category = category
      manga.image = image
      manga.link = link
      await manga.save()
      res.render('successadmin', { message: 'Sửa truyện thành công' })
    }
  } catch (error) {
    console.error('Lỗi khi cập nhật truyện:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi cập nhật truyện' })
  }
})

router.get('/getmanga', async (req, res) => {
  try {
    const manga = await Manga.find().lean().populate('manganame')
    res.json(manga)
  } catch (error) {
    console.error('Lỗi khi lấy danh sách truyện:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi lấy danh sách truyện.' })
  }
})

router.post(
  '/mangaputnew/:_id/:userid',
  upload.fields([{ name: 'image', maxCount: 1 }]),
  async (req, res) => {
    try {
      const userId = req.params.userid
      const mangaId = req.params._id
      const { manganame, author, content, category, link } = req.body
      const uploadedImage = req.files['image']
        ? `http://localhost:8080/${req.files['image'][0].filename}`
        : null

      const user = await User.findById(userId)
      if (!user || typeof userId !== 'string') {
        console.log('Session:', req.session)
        return res.status(403).json({ message: 'Không có id.' })
      }

      const manga = await Manga.findById(mangaId)
      if (!manga) {
        return res.status(404).json({ message: 'Không tìm thấy truyện.' })
      }

      if (manga.category !== category) {
        const oldCategory = await Category.findOne({
          categoryname: manga.category
        })
        if (oldCategory) {
          oldCategory.manga = oldCategory.manga.filter(
            id => id.toString() !== mangaId
          )
          await oldCategory.save()
        }

        const newCategory = await Category.findOne({ categoryname: category })
        if (newCategory) {
          newCategory.manga.push(mangaId)
          await newCategory.save()
        }
      }

      if (user.role === 'nhomdich') {
        manga.pendingChanges = {
          manganame,
          author,
          content,
          category,
          image: uploadedImage || manga.image,
          link
        }
        manga.isApproved = false

        const notification = new Notification({
          adminId: '653a20c611295a22062661f9',
          title: 'Duyệt sửa truyện',
          content: `Truyện ${manganame} cần được duyệt để sửa.`,
          userId: userId,
          mangaId: manga._id,
          isRead: false
        })

        await Promise.all([manga.save(), notification.save()])

        res.json({
          message: 'Truyện của bạn vừa được sửa và đang đợi duyệt'
        })
      } else {
        manga.pendingChanges = undefined
        manga.isApproved = true
        manga.manganame = manganame
        manga.author = author
        manga.content = content
        manga.category = category
        manga.image = uploadedImage || manga.image
        manga.link = link
        await manga.save()

        res.json({ message: 'Sửa truyện thành công' })
      }
    } catch (error) {
      console.error('Lỗi khi cập nhật truyện:', error)
      res.status(500).json({ error: 'Đã xảy ra lỗi khi cập nhật truyện' })
    }
  }
)

router.post('/mangadelete/:_id', async (req, res) => {
  try {
    const userId = req.session.userId
    const mangaId = req.params._id
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ message: 'user không tồn tại.' })
    }

    const deletedManga = await Manga.findByIdAndRemove(mangaId)

    if (!deletedManga) {
      return res.status(404).json({ message: 'truyện không tồn tại.' })
    }

    const category = await Category.findOne({ manga: mangaId })
    if (category) {
      category.manga = category.manga.filter(id => id.toString() !== mangaId)
      await category.save()
    }

    await Chapter.deleteMany({ mangaName: deletedManga.manganame })
    await User.updateMany(
      { 'favoriteManga.mangaId': mangaId },
      { $pull: { favoriteManga: { mangaId: mangaId } } }
    )

    if (user.role === 'nhomdich') {
      res.render('successnhomdich', { message: 'Xóa truyện thành công' })
    } else {
      res.render('successadmin', { message: 'Xóa truyện thành công' })
    }
  } catch (error) {
    console.error('Lỗi khi xóa truyện:', error)
    res.status(500).json({ message: 'Đã xảy ra lỗi khi xóa truyện.' })
  }
})

router.post('/mangadeletenew/:_id', async (req, res) => {
  try {
    const mangaId = req.params._id

    const deletedManga = await Manga.findByIdAndRemove(mangaId)

    if (!deletedManga) {
      return res.status(404).json({ message: 'truyện không tồn tại.' })
    }

    const category = await Category.findOne({ manga: mangaId })
    if (category) {
      category.manga = category.manga.filter(id => id.toString() !== mangaId)
      await category.save()
    }

    await Chapter.deleteMany({ mangaName: deletedManga.manganame })
    await User.updateMany(
      { 'favoriteManga.mangaId': mangaId },
      { $pull: { favoriteManga: { mangaId: mangaId } } }
    )

    res.json({ message: 'Xóa truyện thành công' })
  } catch (error) {
    console.error('Lỗi khi xóa truyện:', error)
    res.status(500).json({ message: 'Đã xảy ra lỗi khi xóa truyện.' })
  }
})

router.get('/mangachitiet/:mangaId/:userId', async (req, res) => {
  try {
    const mangaId = req.params.mangaId
    const userId = req.params.userId
    const manga = await Manga.findById(mangaId)
      .populate({
        path: 'chapters',
        select: 'number viporfree price',
        options: { sort: { number: 1 } }
      })
      .exec()

    manga.chapters.forEach(chapter => {
      chapter.number = parseInt(chapter.number)
    })
    manga.chapters.sort((a, b) => a.number - b.number)

    if (!manga) {
      return res.status(404).json({ message: 'Không tìm thấy truyện.' })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' })
    }
    const topUsers = await Payment.aggregate([
      {
        $match: { success: 'thanh toán thành công' }
      },
      {
        $group: {
          _id: '$userID',
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      {
        $sort: { totalAmount: -1 }
      },
      {
        $limit: 10
      }
    ])

    const extendedTopUsers = await Promise.all(
      topUsers.map(async user => {
        const userInfo = await User.findById(user._id).select(
          'username role avatar'
        )

        return {
          userID: user._id,
          username: userInfo.username,
          role: userInfo.role,
          avatar: userInfo.avatar || '',
          totalAmount: user.totalAmount,
          coin: user.totalAmount * 10,
          rolevip: 'vip'
        }
      })
    )

    const allUsers = await User.find()

    const topUserIds = new Set(
      extendedTopUsers.slice(0, 3).map(user => user.userID)
    )

    // Tạo một đối tượng để lưu trữ thông tin role và rolevip của mỗi người dùng
    const userRoles = {}

    // Xử lý rolevip cho top users
    extendedTopUsers.forEach(user => {
      userRoles[user.userID.toString()] = {
        userId: user.userID,
        username: user.username,
        role: user.role,
        avatar: user.avatar,
        rolevip: 'vip'
      }
    })

    // Xử lý rolevip cho những người dùng không phải top users, admin, và nhomdich
    allUsers.forEach(user => {
      if (
        !topUserIds.has(user._id.toString()) &&
        user.role !== 'admin' &&
        user.role !== 'nhomdich'
      ) {
        userRoles[user._id.toString()] = {
          userId: user._id,
          username: user.username,
          role: user.role,
          avatar: user.avatar,
          rolevip: 'notvip'
        }
      }
      if (
        topUserIds.has(user._id.toString()) ||
        user.role === 'admin' ||
        user.role === 'nhomdich'
      ) {
        userRoles[user._id.toString()] = {
          userId: user._id,
          username: user.username,
          role: user.role,
          avatar: user.avatar,
          rolevip: 'vip'
        }
      }
    })

    const {
      manganame,
      author,
      content,
      image,
      category,
      view,
      like,
      chapters,
      comment,
      link,
      userID
    } = manga

    const chapterSet = new Set() // Sử dụng Set để lưu tránh chapter bị lặp
    const uniqueChapters = []

    manga.chapters.forEach(chapter => {
      if (!chapterSet.has(chapter._id)) {
        chapterSet.add(chapter._id)
        uniqueChapters.push(chapter)
        let viporfree = chapter.viporfree
        let price = chapter.price
        user.purchasedChapters.forEach(purchased => {
          if (purchased.chapterId.toString() === chapter._id.toString()) {
            viporfree = 'free'
            price = 0
          }
        })
        chapter.viporfree = viporfree
        chapter.price = price
      }
    })

    let isLiked = false
    user.favoriteManga.forEach(favorite => {
      if (favorite.mangaId.toString() === mangaId) {
        isLiked = favorite.isLiked
      }
    })

    const allComments = []
    for (const com of comment) {
      const formatdatecmt = moment(com.date).format('DD/MM/YYYY HH:mm:ss')
      const userComment = userRoles[com.userID.toString()]
      const username = userComment.username
      const commentInfo = {
        cmt_id: com._id,
        userID: com.userID,
        username: username,
        avatar: userComment.avatar || '',
        role: userComment.role,
        rolevip: userComment.rolevip,
        cmt: com.cmt,
        date: formatdatecmt
      }
      allComments.push(commentInfo)
    }
    const nhomdich = await User.findById(userID)
    const response = {
      mangaID: mangaId,
      manganame: manganame,
      author: author,
      content: content,
      image: image,
      category: category,
      nhomdichId: userID,
      nhomdich: nhomdich.username,
      view: view,
      like: like,
      linktruyen: link,
      totalChapters: uniqueChapters.length,
      chapters: uniqueChapters.map(chapter => ({
        idchap: chapter._id,
        namechap: chapter.number,
        viporfree: chapter.viporfree,
        price: chapter.price
      })),
      isLiked: isLiked,
      comments: allComments,
      totalcomment: allComments.length
    }

    res.json(response)
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết truyện:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi lấy chi tiết truyện.' })
  }
})

router.get('/mangas/category/:categoryName', async (req, res) => {
  try {
    const categoryName = req.params.categoryName
    const category = await Category.findOne({ categoryname: categoryName })

    if (!category) {
      return res.status(404).json({ message: 'Không tìm thấy thể loại.' })
    }

    const mangaList = await Manga.find({ category: categoryName })

    if (mangaList.length === 0) {
      return res
        .status(404)
        .json({ message: 'Không tìm thấy truyện trong thể loại này.' })
    }

    const formattedMangaList = mangaList.map(manga => ({
      id: manga._id,
      manganame: manga.manganame,
      image: manga.image,
      category: manga.category,
      totalChapters: manga.chapters.length
    }))

    res.json(formattedMangaList)
  } catch (error) {
    console.error('Lỗi khi lấy truyện theo thể loại:', error)
    res
      .status(500)
      .json({ error: 'Đã xảy ra lỗi khi lấy truyện theo thể loại.' })
  }
})

router.get('/top5manga', async (req, res) => {
  try {
    const topManga = await Manga.aggregate([
      { $sort: { view: -1 } }, // Sắp xếp theo lượt xem giảm dần
      { $limit: 5 } // Lấy 5 bản ghi đầu tiên
    ])
    res.json(topManga)
  } catch (error) {
    console.error('Lỗi khi lấy danh sách top 10 truyện:', error)
    res
      .status(500)
      .json({ error: 'Đã xảy ra lỗi khi lấy danh sách top 10 truyện' })
  }
})

router.post('/user/addFavoriteManga/:userId/:mangaId', async (req, res) => {
  try {
    const userId = req.params.userId
    const mangaId = req.params.mangaId
    const manga = await Manga.findById(mangaId)
    if (!manga) {
      return res.status(404).json({ message: 'Không tìm thấy truyện.' })
    }
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' })
    }

    const mangaIndex = user.favoriteManga.findIndex(
      manga => manga._id === mangaId
    )

    if (mangaIndex === -1) {
      manga.like += 1
      await manga.save()
      user.favoriteManga.push({ mangaId, isLiked: true })
    } else {
      user.favoriteManga[mangaIndex].isLiked = true
    }
    await user.save()

    res.json({ message: 'Truyện đã được thêm vào danh sách yêu thích.' })
  } catch (error) {
    console.error('Lỗi khi thêm truyện yêu thích:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi thêm truyện yêu thích.' })
  }
})

router.get('/user/favoriteManga/:userId', async (req, res) => {
  try {
    const userId = req.params.userId

    // Tìm người dùng dựa trên userId
    const user = await User.findById(userId).populate({
      path: 'favoriteManga',
      populate: {
        path: 'mangaId',
        model: 'manga'
      }
    })

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' })
    }

    const favoriteMangaList = user.favoriteManga.map(manga => {
      return {
        id: manga.mangaId._id,
        manganame: manga.mangaId.manganame,
        image: manga.mangaId.image,
        category: manga.mangaId.category,
        totalChapters: manga.mangaId.chapters.length
      }
    })

    res.json(favoriteMangaList)
  } catch (error) {
    console.error('Lỗi khi lấy danh sách truyện yêu thích:', error)
    res
      .status(500)
      .json({ error: 'Đã xảy ra lỗi khi lấy danh sách truyện yêu thích.' })
  }
})

router.post('/user/removeFavoriteManga/:userId/:mangaId', async (req, res) => {
  try {
    const userId = req.params.userId
    const mangaId = req.params.mangaId
    const manga = await Manga.findById(mangaId)
    if (!manga) {
      return res.status(404).json({ message: 'Không tìm thấy truyện.' })
    }

    const user = await User.findById(userId)

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' })
    }
    if (
      !user.favoriteManga.some(manga => manga.mangaId.toString() === mangaId)
    ) {
      return res
        .status(400)
        .json({ message: 'Truyện không tồn tại trong danh sách yêu thích.' })
    }
    manga.like -= 1
    await manga.save()
    user.favoriteManga = user.favoriteManga.filter(
      manga => manga.mangaId.toString() !== mangaId
    ) // Xóa truyện yêu thích khỏi danh sách

    await user.save()

    res.json({ message: 'Truyện đã được xóa khỏi danh sách yêu thích.' })
  } catch (error) {
    console.error('Lỗi khi xóa truyện yêu thích:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi xóa truyện yêu thích.' })
  }
})

router.post('/postcomment/:userId/:mangaId', async (req, res) => {
  try {
    const userId = req.params.userId
    const mangaId = req.params.mangaId
    const { comment } = req.body
    const vietnamTime = momenttimezone().add(7, 'hours').toDate()
    const user = await User.findById(userId)
    if (!user) {
      res.status(404).json({ message: 'không tìm thấy user' })
    }
    const manga = await Manga.findById(mangaId)
    if (!manga) {
      res.status(404).json({ message: 'không tìm thấy truyện' })
    }
    const newComment = {
      userID: userId,
      cmt: comment,
      date: vietnamTime
    }
    manga.comment.push(newComment)
    await manga.save()
    res.status(200).json({ message: 'Đã thêm bình luận thành công' })
  } catch (error) {
    console.error('Lỗi khi post bình luận:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi post bình luận.' })
  }
})
router.post('/deletecomment/:commentId/:mangaID/:userId', async (req, res) => {
  try {
    const commentId = req.params.commentId
    const mangaId = req.params.mangaID
    const userId = req.params.userId

    const user = await User.findById(userId)
    if (!user) {
      res.status(404).json({ message: 'không tìm thấy user' })
    }

    const manga = await Manga.findById(mangaId)
    if (!manga) {
      res.status(404).json({ message: 'không tìm thấy truyện này' })
    }

    const commentToDelete = manga.comment.find(
      cmt => cmt._id == commentId && cmt.userID == userId
    )

    if (!commentToDelete) {
      res.status(403).json({ message: 'Bạn không có quyền xóa comment này' })
      return
    }
    const commentIndex = manga.comment.findIndex(cmt => cmt._id == commentId)
    if (commentIndex === -1) {
      return res
        .status(404)
        .json({ message: 'Không tìm thấy comment với ID cung cấp' })
    }

    manga.comment.splice(commentIndex, 1) // Xóa comment từ mảng

    // Lưu lại thay đổi vào cơ sở dữ liệu
    await manga.save()

    res.status(200).json({ message: 'Xóa comment thành công' })
  } catch (error) {
    console.error('Lỗi khi xóa comment:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi xóa comment.' })
  }
})

module.exports = router
