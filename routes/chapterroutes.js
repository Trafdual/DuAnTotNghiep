const router = require('express').Router()
const User = require('../models/UserModel')
const cheerio = require('cheerio')
const Manga = require('../models/MangaModel')
const Chapter = require('../models/ChapterModel')
const Notification = require('../models/NotifyModel')

router.get('/getchap', async (req, res) => {
  try {
    const { userId } = req.session
    const page = parseInt(req.query.page) || 1 // Trang hiện tại (mặc định 1)
    const limit = parseInt(req.query.limit) || 10 // Số item mỗi trang (mặc định 10)
    const skip = (page - 1) * limit

    const user = await User.findById(userId).lean()
    if (!user) {
      return res.status(403).json({ message: 'Không tìm thấy user' })
    }

    let query = { isChap: true }

    if (user.role !== 'admin') {
      const mangaList = await Manga.find({ userID: userId }).lean()
      const mangaNames = mangaList.map(m => m.manganame)
      query.mangaName = { $in: mangaNames }
    }

    const totalCount = await Chapter.countDocuments(query)

    const chapters = await Chapter.find(query)
      .select('mangaName number viporfree price isChap')
      .sort({ mangaName: 1 })
      .skip(skip)
      .limit(limit)
      .lean()

    const totalPages = Math.ceil(totalCount / limit)

    return res.render('chapter', {
      data: chapters,
      userId,
      currentPage: page,
      totalPages
    })
  } catch (error) {
    console.error('Lỗi khi lấy danh sách chap:', error)
    return res
      .status(500)
      .json({ error: 'Đã xảy ra lỗi khi lấy danh sách chap.' })
  }
})

router.get('/getchapnew/:userid', async (req, res) => {
  try {
    const userId = req.params.userid
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit

    const user = await User.findById(userId).lean().select('role')
    if (!user) {
      return res.status(403).json({ message: 'Không tìm thấy user' })
    }

    let query = { isChap: true }

    if (user.role !== 'admin') {
      const mangaNames = await Manga.find({ userID: userId })
        .lean()
        .select('manganame')
        .then(list => list.map(m => m.manganame))

      if (mangaNames.length === 0) {
        return res.json({ data: [], currentPage: page, totalPages: 0 })
      }

      query.mangaName = { $in: mangaNames }
    }

    const [totalCount, chapters] = await Promise.all([
      Chapter.countDocuments(query),
      Chapter.find(query)
        .select('mangaName number viporfree price isChap images')
        .sort({ mangaName: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ])

    const totalPages = Math.ceil(totalCount / limit)

    return res.json({
      data: chapters,
      currentPage: page,
      totalPages
    })
  } catch (error) {
    console.error('Lỗi khi lấy danh sách chap:', error)
    return res
      .status(500)
      .json({ error: 'Đã xảy ra lỗi khi lấy danh sách chap.' })
  }
})

router.get('/searchchap/:userid', async (req, res) => {
  try {
    const userId = req.params.userid
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit
    const search = req.query.search?.trim() // Tên truyện cần tìm

    const user = await User.findById(userId).lean().select('role')
    if (!user) {
      return res.status(403).json({ message: 'Không tìm thấy user' })
    }

    let query = { isChap: true }

    if (user.role !== 'admin') {
      const mangaNames = await Manga.find({ userID: userId })
        .lean()
        .select('manganame')
        .then(list => list.map(m => m.manganame))

      if (mangaNames.length === 0) {
        return res.json({ data: [], currentPage: page, totalPages: 0 })
      }

      query.mangaName = { $in: mangaNames }
    }

    // Nếu có tìm kiếm theo tên truyện
    if (search) {
      const regex = new RegExp(search, 'i') // không phân biệt hoa thường
      query.mangaName = query.mangaName
        ? { $in: query.mangaName.$in.filter(name => regex.test(name)) }
        : { $regex: regex }
    }

    const [totalCount, chapters] = await Promise.all([
      Chapter.countDocuments(query),
      Chapter.find(query)
        .select('mangaName number viporfree price isChap images')
        .sort({ mangaName: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ])

    const totalPages = Math.ceil(totalCount / limit)

    return res.json({
      data: chapters,
      currentPage: page,
      totalPages
    })
  } catch (error) {
    console.error('Lỗi khi lấy danh sách chap:', error)
    return res
      .status(500)
      .json({ error: 'Đã xảy ra lỗi khi lấy danh sách chap.' })
  }
})

router.get('/chap', async (req, res) => {
  try {
    const chap = await Chapter.find()
    res.status(201).json(chap)
  } catch (error) {
    console.error('Lỗi khi lấy danh sách truyện:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi lấy danh sách truyện' })
  }
})

router.get('/viporfrees', async (req, res) => {
  try {
    // Sử dụng mongoose để lấy danh sách các giá trị enum
    const enumValues = await Chapter.schema.path('viporfree').enumValues
    res.json(enumValues)
  } catch (error) {
    console.error('Lỗi khi lấy danh sách giá trị enum:', error)
    res
      .status(500)
      .json({ error: 'Đã xảy ra lỗi khi lấy danh sách giá trị enum' })
  }
})

router.post('/purchaseChapter/:userId/:chapterId', async (req, res) => {
  try {
    const { userId, chapterId } = req.params

    // Kiểm tra người dùng và chương có tồn tại hay không
    const user = await User.findById(userId)
    const chapter = await Chapter.findById(chapterId)

    if (!user || !chapter) {
      return res
        .status(404)
        .json({ message: 'Người dùng hoặc chương không tồn tại' })
    }

    const chapterPurchased = user.purchasedChapters.includes(chapterId)

    if (chapterPurchased) {
      return res.status(400).json({ message: 'Chương đã được mua trước đó' })
    }

    const chapterPrice = chapter.price

    if (isNaN(user.coin)) {
      return res.status(500).json({ message: 'Lỗi: Giá trị coin không hợp lệ' })
    }

    if (user.coin < chapterPrice) {
      return res.status(400).json({ message: 'Không đủ coin để mua chương' })
    }

    user.coin -= chapterPrice
    await user.save()

    const purchasedChapter = {
      chapterId: chapterId,
      isChapterFree: true
    }

    user.purchasedChapters.push(purchasedChapter)
    await user.save()

    res
      .status(200)
      .json({ message: 'Mua chương thành công và cập nhật trạng thái chương' })
  } catch (error) {
    console.error('Lỗi khi mua chương:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi mua chương' })
  }
})

router.post('/chapters', async (req, res) => {
  try {
    const userId = req.session.userId
    const { mangaName, number, viporfree, images } = req.body
    const user = await User.findById(userId)
    if (!userId || typeof userId !== 'string') {
      console.log('Session:', req.session)
      return res.status(403).json({ message: 'Không có id.' })
    }
    if (!user) {
      console.log('Session:', req.session)
      return res.status(403).json({ message: 'Không tìm thấy user.' })
    }

    const imageArray = images.split('\n')

    const manga = await Manga.findOne({ manganame: mangaName })
    if (!manga) {
      return res
        .status(404)
        .json({ message: 'Không tìm thấy truyện liên quan đến chương này.' })
    }

    const chapter = new Chapter({
      mangaName,
      number,
      viporfree,
      images: imageArray
    })
    if (user.role === 'nhomdich') {
      const notification = new Notification({
        adminId: '653a20c611295a22062661f9',
        title: 'Duyệt thêm chap',
        content: `Chap ${number} - Truyện ${mangaName} cần được duyệt.`,
        userId: userId,
        mangaId: chapter._id
      })
      await notification.save()
      if (chapter.viporfree === 'free') {
        chapter.price = 0
      } else {
        chapter.price = 2
      }
      chapter.isChap = false
      await chapter.save()
      manga.chapters.push(chapter._id)
      await manga.save()
      res.render('successnhomdich', {
        message: 'Chap của bạn đã thêm thành công và đang đợi xét duyệt'
      })
    } else {
      if (chapter.viporfree === 'free') {
        chapter.price = 0
      } else {
        chapter.price = 2
      }
      chapter.isChap = true
      await chapter.save()
      manga.chapters.push(chapter._id)
      await manga.save()
      res.render('successadmin', { message: 'Thêm chap thành công' })
    }
  } catch (error) {
    console.error('Lỗi khi tạo chương:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi tạo chương' })
  }
})

router.post('/chaptersnew/:userId', async (req, res) => {
  try {
    const userId = req.params.userId
    const { mangaName, number, viporfree, images } = req.body
    const user = await User.findById(userId)
    if (!userId || typeof userId !== 'string') {
      return res.status(403).json({ message: 'Không có id.' })
    }
    if (!user) {
      return res.status(403).json({ message: 'Không tìm thấy user.' })
    }

    const imageArray = images.split('\n')

    const manga = await Manga.findOne({ manganame: mangaName })
    if (!manga) {
      return res
        .status(404)
        .json({ message: 'Không tìm thấy truyện liên quan đến chương này.' })
    }

    const chapter = new Chapter({
      mangaName,
      number,
      viporfree,
      images: imageArray
    })
    if (user.role === 'nhomdich') {
      const notification = new Notification({
        adminId: '653a20c611295a22062661f9',
        title: 'Duyệt thêm chap',
        content: `Chap ${number} - Truyện ${mangaName} cần được duyệt.`,
        userId: userId,
        mangaId: chapter._id
      })
      await notification.save()
      if (chapter.viporfree === 'free') {
        chapter.price = 0
      } else {
        chapter.price = 2
      }
      chapter.isChap = false
      await chapter.save()
      manga.chapters.push(chapter._id)
      await manga.save()
      res.json({
        message: 'Chap của bạn đã thêm thành công và đang đợi xét duyệt'
      })
    } else {
      if (chapter.viporfree === 'free') {
        chapter.price = 0
      } else {
        chapter.price = 2
      }
      chapter.isChap = true
      await chapter.save()
      manga.chapters.push(chapter._id)
      await manga.save()
      res.json({ message: 'Thêm chap thành công' })
    }
  } catch (error) {
    console.error('Lỗi khi tạo chương:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi tạo chương' })
  }
})

router.post('/chapterput/:_id', async (req, res) => {
  try {
    const userId = req.session.userId
    const user = await User.findById(userId)
    if (!user || typeof userId !== 'string') {
      console.log('Session:', req.session)
      return res.status(403).json({ message: 'Không có id.' })
    }
    const chapterId = req.params._id
    let { mangaName, number, viporfree, images, price } = req.body
    const imageArray = images.split('\n')
    number = number.toString()
    const chapter = await Chapter.findById(chapterId)

    if (!chapter) {
      return res.status(404).json({ message: 'Không tìm thấy chương' })
    }
    const manga = await Manga.findOne({ chapters: chapterId })
    if (manga) {
      manga.chapters = manga.chapters.filter(id => id.toString() !== chapterId)
      manga.chapters.push(chapterId)
      await manga.save()
    }
    if (viporfree === 'vip') {
      price = 2
    } else {
      price = 0
    }
    if (user.role === 'nhomdich') {
      chapter.pendingChanges = {
        mangaName,
        number,
        viporfree,
        price,
        images: imageArray,
        isChap: true
      }
      chapter.isApproved = false
      const notification = new Notification({
        adminId: '653a20c611295a22062661f9',
        title: 'Duyệt sửa chap',
        content: ` Chap ${number} - Truyện ${mangaName} cần được duyệt để sửa .`,
        userId: userId,
        mangaId: chapterId,
        isRead: false
      })
      await Promise.all([chapter.save(), notification.save()])
      res.render('successnhomdich', {
        message: 'Chap của bạn vừa được sửa và đang đợi duyệt'
      })
    } else {
      chapter.pendingChanges = undefined
      chapter.isApproved = true
      ;(chapter.mangaName = mangaName),
        (chapter.number = number),
        (chapter.viporfree = viporfree),
        (chapter.price = price),
        (chapter.images = imageArray),
        (chapter.isChap = true)
      await chapter.save()
      res.render('successadmin', { message: 'Chap sửa thành công' })
    }
  } catch (error) {
    console.error('Lỗi khi cập nhật chương:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi cập nhật chương' })
  }
})

router.post('/chapterputnew/:_id/:userid', async (req, res) => {
  try {
    const userId = req.params.userid
    const user = await User.findById(userId)
    if (!user || typeof userId !== 'string') {
      return res.status(403).json({ message: 'Không có id.' })
    }
    const chapterId = req.params._id
    let { mangaName, number, viporfree, images, price } = req.body
    const imageArray = images.split('\n')
    number = number.toString()
    const chapter = await Chapter.findById(chapterId)

    if (!chapter) {
      return res.status(404).json({ message: 'Không tìm thấy chương' })
    }
    const manga = await Manga.findOne({ chapters: chapterId })
    if (manga) {
      manga.chapters = manga.chapters.filter(id => id.toString() !== chapterId)
      manga.chapters.push(chapterId)
      await manga.save()
    }
    if (viporfree === 'vip') {
      price = 2
    } else {
      price = 0
    }
    if (user.role === 'nhomdich') {
      chapter.pendingChanges = {
        mangaName,
        number,
        viporfree,
        price,
        images: imageArray,
        isChap: true
      }
      chapter.isApproved = false
      const notification = new Notification({
        adminId: '653a20c611295a22062661f9',
        title: 'Duyệt sửa chap',
        content: `Chap ${number} - Truyện ${mangaName} cần được duyệt để sửa .`,
        userId: userId,
        mangaId: chapterId,
        isRead: false
      })
      await Promise.all([chapter.save(), notification.save()])
      res.json({
        message: 'Chap của bạn vừa được sửa và đang đợi duyệt'
      })
    } else {
      chapter.pendingChanges = undefined
      chapter.isApproved = true
      ;(chapter.mangaName = mangaName),
        (chapter.number = number),
        (chapter.viporfree = viporfree),
        (chapter.price = price),
        (chapter.images = imageArray),
        (chapter.isChap = true)
      await chapter.save()
      res.json({ message: 'Chap sửa thành công' })
    }
  } catch (error) {
    console.error('Lỗi khi cập nhật chương:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi cập nhật chương' })
  }
})

router.post('/chapterdelete/:_id', async (req, res) => {
  try {
    const userId = req.session.userId
    const chapterId = req.params._id
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ message: 'user không tồn tại.' })
    }

    const deletedChapter = await Chapter.findByIdAndRemove(chapterId)

    if (!deletedChapter) {
      return res.status(404).json({ message: 'Chương không tồn tại.' })
    }

    const manga = await Manga.findOne({ chapters: chapterId })
    if (manga) {
      manga.chapters = manga.chapters.filter(id => id.toString() !== chapterId)
      await manga.save()
    }

    if (user.role === 'nhomdich') {
      res.render('successnhomdich', { message: 'Xóa chap thành công' })
    } else {
      res.render('successadmin', { message: 'Xóa chap thành công' })
    }
  } catch (error) {
    console.error('Lỗi khi xóa chương:', error)
    res.status(500).json({ message: 'Đã xảy ra lỗi khi xóa chương.' })
  }
})

router.get('/chapterchitiet/:_id', async (req, res) => {
  try {
    const chapterid = req.params._id

    const chapter = await Chapter.findById(chapterid)

    if (!chapter) {
      return res.status(404).json({ message: 'Không tìm thấy chap.' })
    }
    const htmlToParse = '<html><head>...</head>' + chapter.images + '</html>'

    // Kiểm tra dữ liệu trước khi sử dụng cheerio
    console.log('Raw HTML data:', chapter.images)

    const imageLinks = []
    const $ = cheerio.load(htmlToParse, {
      normalizeWhitespace: true,
      xmlMode: true
    })

    $('img').each((index, element) => {
      const src = $(element).attr('src')
      if (src) {
        imageLinks.push(src)
      } else {
        console.error('Không tìm thấy thuộc tính src trong thẻ img')
      }
    })

    res.json(imageLinks)
  } catch (error) {
    console.error('Lỗi khi lấy danh sách ảnh chap:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi lấy danh sách ảnh chap.' })
  }
})

router.get('/chapternotify/:chapterId', async (req, res) => {
  try {
    const chapterId = req.params.chapterId

    const notification = await Notification.findOne({ mangaId: chapterId })

    if (!notification) {
      return res
        .status(404)
        .json({ error: 'Không tìm thấy thông báo cho chap này.' })
    }
    const chapterDetail = await Chapter.findById(chapterId)

    if (!chapterDetail) {
      return res.status(404).json({ error: 'Không tìm thấy chi tiết chap.' })
    }
    const htmlToParse =
      '<html><head>...</head>' + chapterDetail.images + '</html>'

    // Kiểm tra dữ liệu trước khi sử dụng cheerio
    console.log('Raw HTML data:', chapterDetail.images)

    const imageLinks = []
    const $ = cheerio.load(htmlToParse, {
      normalizeWhitespace: true,
      xmlMode: true
    })

    $('img').each((index, element) => {
      const src = $(element).attr('src')
      if (src) {
        imageLinks.push(src)
      } else {
        console.error('Không tìm thấy thuộc tính src trong thẻ img')
      }
    })
    res.json({
      mangaName: chapterDetail.mangaName,
      number: chapterDetail.number,
      viporfree: chapterDetail.viporfree,
      price: chapterDetail.price,
      images: imageLinks
    })
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết chap:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi lấy chi tiết chap.' })
  }
})

router.get('/chapternotifysua/:chapterId', async (req, res) => {
  try {
    const chapterId = req.params.chapterId

    const notification = await Notification.findOne({ mangaId: chapterId })

    if (!notification) {
      return res
        .status(404)
        .json({ error: 'Không tìm thấy thông báo cho chap này.' })
    }
    const chapterDetail = await Chapter.findById(chapterId)

    if (!chapterDetail) {
      return res.status(404).json({ error: 'Không tìm thấy chap chi tiết.' })
    }
    const htmlToParse =
      '<html><head>...</head>' + chapterDetail.pendingChanges.images + '</html>'

    // Kiểm tra dữ liệu trước khi sử dụng cheerio
    console.log('Raw HTML data:', chapterDetail.pendingChanges.images)

    const imageLinks = []
    const $ = cheerio.load(htmlToParse, {
      normalizeWhitespace: true,
      xmlMode: true
    })

    $('img').each((index, element) => {
      const src = $(element).attr('src')
      if (src) {
        imageLinks.push(src)
      } else {
        console.error('Không tìm thấy thuộc tính src trong thẻ img')
      }
    })
    res.json({
      mangaName: chapterDetail.pendingChanges.mangaName,
      number: chapterDetail.pendingChanges.number,
      viporfree: chapterDetail.pendingChanges.viporfree,
      price: chapterDetail.pendingChanges.price,
      images: imageLinks
    })
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết truyện:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi lấy chi tiết truyện.' })
  }
})

router.post('/huychap/:chapterId/:id', async (req, res) => {
  try {
    const chapterId = req.params.chapterId
    const notifyId = req.params.id
    const { reason } = req.body
    const chapter = await Chapter.findByIdAndDelete(chapterId)
    const notify = await Notification.findByIdAndDelete(notifyId)

    const newNotification = new Notification({
      adminId: req.session.userId,
      title: 'Đã bị hủy',
      content: `Chap ${chapter.number} - Truyện ${chapter.mangaName} của bạn đã bị hủy - lí do: ${reason}.`,
      userId: notify.userId,
      mangaId: chapterId
    })
    await newNotification.save()
    res.render('successadmin', { message: 'Hủy thêm chap thành công' })
  } catch (error) {
    console.error('Lỗi duyệt truyện', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi duyệt truyện' })
  }
})

router.post('/huychapput/:chapterId/:id', async (req, res) => {
  try {
    const chapterId = req.params.chapterId
    const notifyId = req.params.id
    const { reason } = req.body
    const chapter = await Chapter.findById(chapterId)
    const notify = await Notification.findByIdAndDelete(notifyId)
    chapter.pendingChanges = undefined
    await chapter.save()

    const newNotification = new Notification({
      adminId: req.session.userId,
      title: 'Đã bị hủy',
      content: `Chap ${chapter.number} - Truyện ${chapter.mangaName} của bạn đã bị hủy - lí do: ${reason}.`,
      userId: notify.userId,
      mangaId: chapterId
    })
    await newNotification.save()

    res.render('successadmin', { message: 'Hủy sửa chap thành công' })
  } catch (error) {
    console.error('Lỗi duyệt truyện', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi duyệt truyện' })
  }
})

router.post('/approvechap/:chapid', async (req, res) => {
  try {
    const chapterId = req.params.chapid

    // Tìm truyện dựa trên ID
    const chapter = await Chapter.findById(chapterId)

    if (!chapter) {
      return res.status(404).send('Không tìm thấy chương')
    }

    // Kiểm tra xem truyện đã được duyệt chưa, nếu chưa thì cập nhật trạng thái và lưu truyện
    if (!chapter.isChap) {
      chapter.isChap = true
      await chapter.save()
      const notify = await Notification.findOneAndDelete({ mangaId: chapterId })
      const newNotification = new Notification({
        adminId: req.session.userId, // Thay đổi đây thành adminId tương ứng
        title: 'Được phê duyệt',
        content: `Chap ${chapter.number} - truyện ${chapter.mangaName} của bạn đã được duyệt và đăng thành công`,
        userId: notify.userId, // Thay đổi đây thành userId tương ứng với nhóm dịch
        mangaId: chapterId
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

router.post('/approvesuachap/:chapId/:id', async (req, res) => {
  try {
    const chapId = req.params.chapId
    const id = req.params.id
    const chapter = await Chapter.findById(chapId)

    if (!chapter) {
      return res.status(404).json({ message: 'Không tìm thấy chap.' })
    }

    if (chapter.isApproved) {
      return res
        .status(400)
        .json({ message: 'Chap đã được duyệt, không thể duyệt lại.' })
    }

    if (chapter.pendingChanges) {
      chapter.mangaName = chapter.pendingChanges.mangaName
      chapter.number = chapter.pendingChanges.number
      chapter.viporfree = chapter.pendingChanges.viporfree
      chapter.price = chapter.pendingChanges.price
      chapter.images = chapter.pendingChanges.images
      chapter.isChap = chapter.pendingChanges.isChap
    }

    chapter.isApproved = true
    chapter.pendingChanges = undefined
    await chapter.save()

    // Xóa thông báo chờ duyệt
    const notification = await Notification.findByIdAndDelete(id)

    // Tạo thông báo cho người sửa truyện
    const newNotification = new Notification({
      adminId: req.session.userId,
      title: 'Được phê duyệt',
      content: `Chap ${chapter.number} - Truyện ${chapter.mangaName} của bạn đã được duyệt và sửa thành công.`,
      userId: notification.userId,
      mangaId: chapId
    })

    await newNotification.save()

    return res.render('successadmin', { message: 'Duyệt thành công' })
  } catch (error) {
    console.error('Lỗi duyệt truyện', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi duyệt truyện' })
  }
})

router.get('/chapter/:_id/:userid/images', async (req, res) => {
  try {
    const chapterid = req.params._id
    const userid = req.params.userid

    const chapter = await Chapter.findById(chapterid)

    if (!chapter) {
      return res.status(404).json({ message: 'Không tìm thấy chap.' })
    }

    const chapters = await Chapter.find({ mangaName: chapter.mangaName })
      .sort({ number: 1 })
      .lean() // Thêm .lean() để đảm bảo kết quả trả về là plain JavaScript objects, không phải Mongoose Documents.

    // Chuyển đổi kiểu dữ liệu của trường number sang số
    chapters.forEach(chap => (chap.number = parseInt(chap.number)))

    // Sắp xếp theo number
    chapters.sort((a, b) => a.number - b.number)
    const currentChapterIndex = chapters.findIndex(
      ch => ch._id.toString() === chapterid
    )
    let nextChapter = null
    let prevChapter = null
    const user = await User.findById(userid)

    if (currentChapterIndex < chapters.length - 1) {
      nextChapter = {
        _id: chapters[currentChapterIndex + 1]._id,
        chapname: chapters[currentChapterIndex + 1].number.toString(),
        images: chapters[currentChapterIndex + 1].images,
        viporfree: chapters[currentChapterIndex + 1].viporfree,
        price: chapters[currentChapterIndex + 1].price
      }

      // Kiểm tra xem id của nextChapter có trong mảng purchasedChapters của user hay không

      const isNextPurchased = user.purchasedChapters.some(
        item => item.chapterId.toString() === nextChapter._id.toString()
      )
      if (isNextPurchased) {
        nextChapter.viporfree = 'free'
        nextChapter.price = 0
      }
    }

    if (currentChapterIndex > 0) {
      prevChapter = {
        _id: chapters[currentChapterIndex - 1]._id,
        chapname: chapters[currentChapterIndex - 1].number.toString(),
        images: chapters[currentChapterIndex - 1].images,
        viporfree: chapters[currentChapterIndex - 1].viporfree,
        price: chapters[currentChapterIndex - 1].price
      }

      const isPrevPurchased = user.purchasedChapters.some(
        item => item.chapterId.toString() === prevChapter._id.toString()
      )
      if (isPrevPurchased) {
        prevChapter.viporfree = 'free'
        prevChapter.price = 0
      }
    }

    const isPurchased = user.purchasedChapters.some(
      item => item.chapterId.toString() === chapterid
    )
    if (isPurchased) {
      chapter.viporfree = 'free'
      chapter.price = 0
    }

    const responseData = {
      _id: chapterid,
      images: chapter.images,
      chapname: chapter.number,
      viporfree: chapter.viporfree,
      price: chapter.price,
      nextchap: nextChapter,
      prevchap: prevChapter
    }

    res.json(responseData)
  } catch (error) {
    console.error('Lỗi khi lấy danh sách ảnh chap:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi lấy danh sách ảnh chap.' })
  }
})

router.post('/search', async (req, res) => {
  const { mangaName } = req.body
  const data = await Chapter.find({ mangaName })
  res.render('chapter', { data })
})

module.exports = router
