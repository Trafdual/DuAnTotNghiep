const router = require('express').Router()
const jwt = require('jsonwebtoken')
const moment = require('moment')
const Category = require('../models/CategoryModel')
const Manga = require('../models/MangaModel')
const Chapter = require('../models/ChapterModel')
const Baiviet = require('../models/BaiVietModel')
const User = require('../models/UserModel')
const cheerio = require('cheerio')

const checkAuth = (req, res, next) => {
  if (!req.session.token) {
    return res.redirect('/loginadmin')
  }
  try {
    const decoded = jwt.verify(req.session.token, 'mysecretkey', {
      expiresIn: '1h'
    })
    req.userData = decoded
    next()
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      req.session.destroy()
      return res.redirect('/loginadmin')
    } else {
      console.error(error)
      return res.status(500).json({ message: 'Đã xảy ra lỗi.' })
    }
  }
}

router.get('/loginadmin', async (req, res) => {
  console.log('Session:', req.session)
  res.render('login')
})

router.get('/userscreen', async (req, res) => {
  try {
    const users = await User.find({
      $or: [{ role: 'user' }, { role: 'nhomdich' }]
    })
    res.render('user', { user: users })
  } catch (error) {
    console.error('Lỗi khi lấy danh sách người dùng:', error)
    res
      .status(500)
      .json({ error: 'Đã xảy ra lỗi khi lấy danh sách người dùng' })
  }
})

router.get('/usernewwweb', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10

    const query = {
      $or: [{ role: 'user' }, { role: 'nhomdich' }]
    }

    const totalUsers = await User.countDocuments(query)

    const users = await User.find(query)
      .select('username phone role coin')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ _id: -1 })

    res.json({
      users,
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
      totalUsers
    })
  } catch (error) {
    console.error('Lỗi khi lấy danh sách người dùng:', error)
    res
      .status(500)
      .json({ error: 'Đã xảy ra lỗi khi lấy danh sách người dùng' })
  }
})

router.get('/admin', checkAuth, async (req, res) => {
  const userId = req.session.userId
  const user = await User.findById(userId)
  if (!user) {
    res.status(403).json({ message: 'không tìm thấy user' })
  }
  res.render('admin', { user })
})

router.get('/logout', async (req, res) => {
  res.redirect('/loginadmin')
})

router.get('/nhomdich', checkAuth, async (req, res) => {
  const userId = req.session.userId
  const user = await User.findById(userId)
  if (!user) {
    res.status(403).json({ message: 'không tìm thấy user' })
  }
  res.render('nhomdich', { user })
})

router.get('/setting', async (req, res) => {
  const userId = req.session.userId
  const user = await User.findById(userId)
  if (!user) {
    res.status(403).json({ message: 'không tìm thấy user' })
  }
  res.render('setting', { user })
})

router.get('/renderbaiviet', async (req, res) => {
  try {
    const userId = req.session.userId
    const user = await User.findById(userId)

    if (!user) {
      res.status(403).json({ message: 'Không tìm thấy user' })
    }
    if (user.role === 'nhomdich') {
      const baiviet = await Baiviet.find({ userId })
      const formattedBaiviet = baiviet.map(item => {
        return {
          _id: item._id,
          content: item.content,
          like: item.like,
          comment: item.comment.length,
          date: moment(item.date).format('DD/MM/YYYY HH:mm:ss')
        }
      })
      res.render('baiviet', {
        baiviet: formattedBaiviet,
        user
      })
    } else {
      const baiviet = await Baiviet.find()
      const formattedBaiviet = baiviet.map(item => {
        return {
          _id: item._id,
          content: item.content,
          like: item.like,
          comment: item.comment.length,
          date: moment(item.date).format('DD/MM/YYYY HH:mm:ss')
        }
      })
      res.render('baiviet', {
        baiviet: formattedBaiviet,
        user
      })
    }
  } catch (error) {
    console.error('Lỗi khi lấy danh sách bài viết:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi lấy danh sách bài viết' })
  }
})

router.get('/renderbaivietnew/:userid', async (req, res) => {
  try {
    const userId = req.params.userid
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit

    const user = await User.findById(userId)
    if (!user) {
      return res.status(403).json({ message: 'Không tìm thấy user' })
    }

    let query = user.role === 'nhomdich' ? { userId } : {}

    const total = await Baiviet.countDocuments(query)
    const baiviet = await Baiviet.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ date: -1 })

    const formattedBaiviet = baiviet.map(item => ({
      _id: item._id,
      content: item.content,
      like: item.like,
      comment: item.comment.length,
      date: moment(item.date).format('DD/MM/YYYY HH:mm:ss')
    }))

    res.json({
      baiviet: formattedBaiviet,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total
    })
  } catch (error) {
    console.error('Lỗi khi lấy danh sách bài viết:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi lấy danh sách bài viết' })
  }
})

router.get('/categoryscreen', async (req, res) => {
  try {
    const userId = req.session.userId
    const user = await User.findById(userId)
    if (!user) {
      res.status(403).json({ message: 'không tìm thấy user' })
    }
    const category = await Category.find()
    res.render('category', { category, user })
  } catch (error) {
    console.error('Lỗi khi lấy danh sách thể loại:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi lấy danh sách thể loại' })
  }
})

router.get('/categorynewweb', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10

    const totalcategory = await Category.countDocuments()

    const category = await Category.find()
      .populate('categoryname')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ _id: -1 })

    res.json({
      category,
      currentPage: page,
      totalPages: Math.ceil(totalcategory / limit),
      totalcategory
    })
  } catch (error) {
    console.error('Lỗi khi lấy danh sách thể loại:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi lấy danh sách thể loại' })
  }
})

router.get('/mangass', async (req, res) => {
  try {
    const userId = req.session.userId
    const user = await User.findById(userId)
    if (!user) {
      res.status(403).json({ message: 'không tìm thấy user' })
    }
    if (user.role === 'nhomdich') {
      const manga = await Manga.find({ isRead: true, userID: userId })
      res.render('home', { manga })
    } else {
      const manga = await Manga.find({ isRead: true })
      res.render('home', { manga })
    }
  } catch (error) {
    console.error('Lỗi khi lấy danh sách truyện:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi lấy danh sách truyện' })
  }
})

router.get('/mangasnew', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10

    const query = { isRead: true }

    const totalmanga = await Manga.countDocuments(query)

    const manga = await Manga.find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ _id: -1 })

    res.json({
      manga,
      currentPage: page,
      totalPages: Math.ceil(totalmanga / limit),
      totalmanga
    })
  } catch (error) {
    console.error('Lỗi khi lấy danh sách truyện:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi lấy danh sách truyện' })
  }
})

router.get('/add', async (req, res) => {
  res.render('add', { userId: req.session.userId })
})

router.get('/mangaput/:_id', async (req, res) => {
  const id = req.params._id
  Manga.findById(id)
    .then(manga => {
      res.render('editmanga', { manga })
    })
    .catch(error => {
      console.error(error)
      res.status(500).send('Internal server error')
    })
})

router.get('/addchap', async (req, res) => {
  console.log('Session:', req.session)
  res.render('addchap', { userId: req.session.userId })
})

router.get('/chapterput/:_id', async (req, res) => {
  const id = req.params._id
  Chapter.findById(id)
    .then(data => {
      res.render('editchap', { data })
    })
    .catch(error => {
      console.error(error)
      res.status(500).send('Internal server error')
    })
})

router.get('/revenue', async (req, res) => {
  res.render('revenue')
})

router.get('/doctruyen', async (req, res) => {
  try {
    const manga = await Manga.find().lean()
    res.render('doctruyen', { manga })
  } catch (err) {
    console.error('Lỗi chuyển màn', err)
  }
})

router.get('/manga/:id/chapters', async (req, res) => {
  try {
    const mangaId = req.params.id
    const manga = await Manga.findById(mangaId).populate({
      path: 'chapters',
      options: { sort: { number: 1 } } // Sắp xếp chương theo số chương tăng dần
    })
    manga.chapters.forEach(chapter => {
      chapter.number = parseInt(chapter.number)
    })
    manga.chapters.sort((a, b) => a.number - b.number)

    if (!manga) {
      return res.status(404).json({ message: 'Truyện không tồn tại' })
    }
    manga.chapters.forEach(chapter => {
      chapter.number = parseInt(chapter.number)
    })

    res.render('docchap', { manga })
  } catch (err) {
    console.error('Lỗi khi lấy danh sách chương', err)
    res.status(500).json({ message: 'Đã xảy ra lỗi' })
  }
})
router.get('/chapter/:_id/images', async (req, res) => {
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

    res.render('anhchap', { imageLinks, chapter })
  } catch (error) {
    console.error('Lỗi khi lấy danh sách ảnh chap:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi lấy danh sách ảnh chap.' })
  }
})
module.exports = router
