const router = require('express').Router()
const User = require('../models/UserModel')
const bcrypt = require('bcryptjs')
const multer = require('multer')
const Manga = require('../models/MangaModel')
const Payment = require('../models/PaymentModel')
const jwt = require('jsonwebtoken')

const storage = multer.memoryStorage()

const upload = multer({ storage: storage })

router.post('/register', async (req, res) => {
  try {
    const { username, password, role, phone } = req.body

    // Kiểm tra số điện thoại
    if (!phone || !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ message: 'Số điện thoại không hợp lệ' })
    }
    const exitphone = await User.findOne({ phone })
    if (exitphone) {
      return res.status(400).json({ message: 'số điện thoại đã được đăng kí' })
    }

    const existingUser = await User.findOne({ username })
    if (existingUser) {
      return res.status(400).json({ message: 'Tên người dùng đã tồn tại' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = new User({
      username,
      password: hashedPassword,
      role,
      coin: 0,
      phone
    })
    await user.save()

    const responseData = {
      success: user.success,
      data: {
        user: [
          {
            _id: user._id,
            username: user.username,
            password: user.password,
            role: user.role,
            coin: user.coin,
            phone: user.phone,
            __v: user.__v
          }
        ]
      }
    }

    res.status(201).json(responseData)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Đã xảy ra lỗi.' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    const user = await User.findOne({ username })

    if (!user) {
      return res
        .status(401)
        .json({ message: 'Tên đăng nhập hoặc mật khẩu không đúng.' })
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ message: 'Tên đăng nhập hoặc mật khẩu không đúng.' })
    }

    const responseData = {
      success: user.success,
      data: {
        user: [
          {
            _id: user._id,
            username: user.username,
            password: user.password,
            role: user.role,
            coin: user.coin,
            avatar: user.avatar || '',
            __v: user.__v
          }
        ]
      }
    }

    const token = jwt.sign({ userId: user._id, role: user.role }, 'mysecretkey')
    responseData.token = token
    res.status(200).json(responseData)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Đã xảy ra lỗi.' })
  }
})

router.get('/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId
    const user = await User.findById(userId)
    if (!user) {
      res.status(404).json({ message: 'user không tồn tại' })
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
    const detailuser = userRoles[user._id.toString()]
    res.json({
      userId: detailuser.userId,
      username: detailuser.username,
      role: detailuser.role,
      rolevip: detailuser.rolevip,
      coin: user.coin,
      avatar: detailuser.avatar || ''
    })
  } catch (err) {
    console.error('Lỗi khi tìm user:', err)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi tìm user.' })
  }
})

router.post('/repass/:userId', async (req, res) => {
  try {
    const { passOld, passNew } = req.body
    const userId = req.params.userId
    const user = await User.findById(userId)
    const hashedPassword = await bcrypt.hash(passNew, 10)
    if (!user) {
      res.status(403).json({ message: 'không tìm thấy user' })
    }
    const isPasswordMatch = await bcrypt.compare(passOld, user.password)

    if (!isPasswordMatch) {
      return res.status(403).json({ message: 'Mật khẩu cũ của bạn không đúng' })
    }
    user.password = hashedPassword
    await user.save()

    return res.status(200).json({ message: 'Đổi mật khẩu thành công' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi đổi mật khẩu' })
  }
})

router.post('/rename/:userId', async (req, res) => {
  try {
    const userId = req.params.userId
    const { username } = req.body
    const user = await User.findByIdAndUpdate(
      userId,
      { username },
      { new: true }
    )
    if (!user) {
      res.status(403).json({ message: 'không tìm thấy user' })
    }
    res.status(200).json({ message: 'đổi tên thành công' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi đổi tên' })
  }
})

router.post('/quenmk', async (req, res) => {
  try {
    const { phone, passNew, username } = req.body
    if (!phone || !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ message: 'Số điện thoại không hợp lệ' })
    }
    const usernam = await User.findOne({ username: username })

    if (!usernam) {
      return res.status(403).json({ message: 'Không tìm thấy username' })
    }

    const user = await User.findOne({ phone: phone })

    if (!user || user.phone === null) {
      return res.status(403).json({ message: 'Không tìm thấy tài khoản' })
    }

    const hashedPassword = await bcrypt.hash(passNew, 10)
    user.password = hashedPassword
    await user.save()

    res.status(200).json({ message: 'Mật khẩu đã được cập nhật' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Đã xảy ra lỗi.' })
  }
})

router.post('/doiavatar/:userId', upload.single('avatar'), async (req, res) => {
  try {
    const userId = req.params.userId
    const user = await User.findById(userId)
    if (!user) {
      res.status(403).json({ message: 'không tìm thấy user' })
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng chọn một file ảnh.' })
    }

    const avatar = req.file.buffer.toString('base64')
    user.avatar = avatar
    await user.save()

    return res.status(200).json({ message: 'Đổi avatar thành công.' })
  } catch (error) {
    console.error('Lỗi khi đổi avatar:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi đổi avatar.' })
  }
})

router.get('/getnhomdich/:nhomdichId', async (req, res) => {
  try {
    const nhomdichId = req.params.nhomdichId
    const nhomdich = await User.findById(nhomdichId)
    if (!nhomdich) {
      res.status(403).json({ message: 'không tìm thấy nhóm dịch' })
    }
    const manga = await Manga.find({ userID: nhomdichId })
    if (!manga) {
      res.status(404).json({ message: 'không tìm thấy manga' })
    }
    const formatmanga = manga.map(manga => ({
      id: manga._id,
      manganame: manga.manganame,
      author: manga.author,
      image: manga.image,
      category: manga.category,
      totalChapters: manga.chapters.length,
      view: manga.view
    }))
    res.json({
      userId: nhomdichId,
      username: nhomdich.username,
      avatar: nhomdich.avatar || '',
      phone: nhomdich.phone,
      follownumber: nhomdich.follownumber || 0,
      manga: formatmanga
    })
  } catch (error) {
    console.error('Lỗi khi lấy thông tin nhóm dịch:', error)
    res
      .status(500)
      .json({ error: 'Đã xảy ra lỗi khi lấy thông tin nhóm dịch.' })
  }
})

router.post('/follow/:nhomdichId/:userId', async (req, res) => {
  try {
    const nhomdichId = req.params.nhomdichId
    const userId = req.params.userId
    const nhomdich = await User.findById(nhomdichId)
    if (!nhomdich) {
      res.status(403).json({ message: 'nhóm dịch không tồn tại' })
    }
    const user = await User.findById(userId)
    if (!user) {
      res.status(403).json({ message: 'user không tồn tại' })
    }
    if (
      typeof nhomdich.follownumber !== 'number' ||
      isNaN(nhomdich.follownumber)
    ) {
      nhomdich.follownumber = 0
    }

    const nhomdichIndex = user.follow.findIndex(
      nhomdich => nhomdich._id === nhomdichId
    )

    if (nhomdichIndex === -1) {
      nhomdich.follownumber += 1
      await nhomdich.save()
      user.follow.push({ nhomdichId, isfollow: true })
    } else {
      user.follow[nhomdichIndex].isfollow = true
    }
    await user.save()

    res.json({ message: `bạn đã follow nhóm dịch ${nhomdich.username}` })
  } catch (error) {
    console.error('Lỗi khi follow nhóm dịch:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi follow nhóm dịch.' })
  }
})

router.get('/getfollow/:userId', async (req, res) => {
  try {
    const userId = req.params.userId

    // Tìm người dùng dựa trên userId
    const user = await User.findById(userId).populate({
      path: 'follow',
      populate: {
        path: 'nhomdichId',
        model: 'user'
      }
    })

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' })
    }

    const favoriteMangaList = user.follow.map(follow => {
      return {
        id: follow.nhomdichId._id,
        username: follow.nhomdichId.username,
        avatar: follow.nhomdichId.avatar || '',
        phone: follow.nhomdichId.phone
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
router.post('/unfollow/:nhomdichId/:userId', async (req, res) => {
  try {
    const nhomdichId = req.params.nhomdichId
    const userId = req.params.userId
    const nhomdich = await User.findById(nhomdichId)
    if (!nhomdich) {
      res.status(403).json({ message: 'nhóm dịch không tồn tại' })
    }
    const user = await User.findById(userId)
    if (!user) {
      res.status(403).json({ message: 'user không tồn tại' })
    }

    if (
      !user.follow.some(
        nhomdich => nhomdich.nhomdichId.toString() === nhomdichId
      )
    ) {
      return res
        .status(400)
        .json({ message: 'Nhóm dịch không tồn tại trong danh sách follow.' })
    }
    nhomdich.follownumber -= 1
    await nhomdich.save()
    user.follow = user.follow.filter(
      nhomdich => nhomdich.nhomdichId.toString() !== nhomdichId
    ) // Xóa truyện yêu thích khỏi danh sách

    await user.save()

    res.json({ message: `bạn đã unfollow nhóm dịch ${nhomdich.username}` })
  } catch (error) {
    console.error('Lỗi khi unfollow nhóm dịch:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi unfollow nhóm dịch.' })
  }
})

router.get('/getnhomdich/:nhomdichId/:userId', async (req, res) => {
  try {
    const nhomdichId = req.params.nhomdichId
    const userId = req.params.userId
    const nhomdich = await User.findById(nhomdichId)
    if (!nhomdich) {
      res.status(403).json({ message: 'không tìm thấy nhóm dịch' })
    }
    const manga = await Manga.find({ userID: nhomdichId })
    if (!manga) {
      res.status(404).json({ message: 'không tìm thấy manga' })
    }
    const user = await User.findById(userId)
    if (!user) {
      res.status(403).json({ message: 'user không tồn tại' })
    }
    let isFollow = false
    user.follow.forEach(follow => {
      if (follow.nhomdichId.toString() === nhomdichId) {
        isFollow = follow.isfollow
      }
    })
    const formatmanga = manga.map(manga => ({
      id: manga._id,
      manganame: manga.manganame,
      author: manga.author,
      image: manga.image,
      category: manga.category,
      totalChapters: manga.chapters.length,
      view: manga.view
    }))

    const formatbank = nhomdich.banking.map(bank => {
      return {
        hovaten: bank.hovaten || 'chưa tích hợp',
        phuongthuc: bank.phuongthuc || 'chưa tích hợp',
        sotaikhoan: bank.sotaikhoan || 'chưa tích hợp',
        maQR: bank.maQR || 'chưa tích hợp'
      }
    })
    res.json({
      userId: nhomdichId,
      username: nhomdich.username,
      avatar: nhomdich.avatar || '',
      phone: nhomdich.phone,
      isfollow: isFollow,
      follownumber: nhomdich.follownumber || 0,
      bank: formatbank,
      manganumber: formatmanga.length,
      manga: formatmanga
    })
  } catch (error) {
    console.error('Lỗi khi lấy thông tin nhóm dịch:', error)
    res
      .status(500)
      .json({ error: 'Đã xảy ra lỗi khi lấy thông tin nhóm dịch.' })
  }
})

router.post('/postchuyenxu/:userid', async (req, res) => {
  try {
    const { username, coin } = req.body
    const userid = req.params.userid
    const userchuyen = await User.findById(userid)
    const user = await User.findOne({ username: username })
    if (!user) {
      res.status(403).json({ message: 'không tìm thấy user' })
    }

    if (userchuyen.coin < coin) {
      res.status(403).json({ message: 'Xu không đủ để chuyển xu' })
    }
    userchuyen.coin -= coin
    await userchuyen.save()
    user.coin += coin
    await user.save()
    res.json({ message: 'chuyển xu thành công' })
  } catch (error) {
    console.error('Lỗi khi chuyển xu:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi chuyển xu.' })
  }
})

router.post('/postcoin/:userid', async (req, res) => {
  try {
    const userid = req.params.userid
    const { coin } = req.body
    const user = await User.findById(userid)
    if (!user) {
      res.status(403).json({ message: 'không tìm thấy user' })
    }
    user.coin += coin
    await user.save()
    res.json({ message: 'nap xu thanh cong' })
  } catch (error) {
    console.error('Lỗi khi nạp xu:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi nạp xu.' })
  }
})
module.exports = router
