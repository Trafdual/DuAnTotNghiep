const router = require('express').Router()
const User = require('../models/UserModel')
const Category = require('../models/CategoryModel')
const Manga = require('../models/MangaModel')

router.get('/categorys', async (req, res) => {
  try {
    const categories = await Category.find().populate('manga')
    const result = categories.map(category => {
      return {
        categoryid: category._id,
        categoryname: category.categoryname,
        manga: category.manga.map(manga => {
          return {
            id: manga._id,
            manganame: manga.manganame,
            image: manga.image,
            category: category.categoryname,
            totalChapters: manga.chapters.length
          }
        })
      }
    })
    res.json(result)
  } catch (error) {
    console.error('Lỗi khi lấy danh sách thể loại:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi lấy danh sách thể loại' })
  }
})

router.post('/category', async (req, res) => {
  try {
    const userId = req.session.userId
    const user = await User.findById(userId)
    if (!user) {
      res.status(403).json({ message: 'không tìm thấy user' })
    }
    const { categoryname } = req.body
    const category = new Category({ categoryname })
    await category.save()
    if (user.role === 'nhomdich') {
      res.render('successnhomdich', { message: 'thêm thể loại thành công' })
    } else {
      res.render('successadmin', { message: 'thêm thể loại thành công' })
    }
  } catch (error) {
    console.error('Lỗi khi tạo thể loại:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi tạo thể loại' })
  }
})

router.post('/addcategory', async (req, res) => {
  try {
    const { categoryname } = req.body
    const category = new Category({ categoryname })
    await category.save()
    res.json(category)
  } catch (error) {
    console.error('Lỗi khi tạo thể loại:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi tạo thể loại' })
  }
})

router.post('/categoryput/:id', async (req, res) => {
  try {
    const userId = req.session.userId
    const user = await User.findById(userId)
    if (!user) {
      res.status(403).json({ message: 'không tìm thấy user' })
    }
    const categoryId = req.params.id
    const { categoryname } = req.body

    const category = await Category.findById(categoryId)

    if (!category) {
      return res.status(404).json({ message: 'Không tìm thấy thể loại.' })
    }
    const manga = await Manga.find({ category: category.categoryname })
    manga.forEach(cate => {
      cate.category = categoryname
    })
    await Promise.all(manga.map(cate => cate.save()))
    category.categoryname = categoryname
    await category.save()

    if (user.role === 'nhomdich') {
      res.render('successnhomdich', { message: 'sửa thể loại thành công' })
    } else {
      res.render('successadmin', { message: 'sửa thể loại thành công' })
    }
  } catch (error) {
    console.error('Lỗi khi cập nhật thể loại:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi cập nhật thể loại.' })
  }
})

router.post('/categoryputnew/:id', async (req, res) => {
  try {
    const categoryId = req.params.id
    const { categoryname } = req.body

    const category = await Category.findById(categoryId)

    if (!category) {
      return res.status(404).json({ message: 'Không tìm thấy thể loại.' })
    }
    const manga = await Manga.find({ category: category.categoryname })
    manga.forEach(cate => {
      cate.category = categoryname
    })
    await Promise.all(manga.map(cate => cate.save()))
    category.categoryname = categoryname
    await category.save()

    res.json(category)
  } catch (error) {
    console.error('Lỗi khi cập nhật thể loại:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi cập nhật thể loại.' })
  }
})

router.post('/categorydelete/:_id', async (req, res) => {
  try {
    const userId = req.session.userId
    const user = await User.findById(userId)
    if (!user) {
      res.status(403).json({ message: 'không tìm thấy user' })
    }
    const categoryId = req.params._id

    const deletedCategory = await Category.findById(categoryId)

    if (!deletedCategory) {
      return res.status(404).json({ message: 'thể loại không tồn tại.' })
    }
    const manga = await Manga.find({ category: deletedCategory.categoryname })
    manga.forEach(cate => {
      cate.category = 'Đang cập nhật'
    })
    await Promise.all(manga.map(cate => cate.save()))

    await deletedCategory.deleteOne()
    if (user.role === 'nhomdich') {
      res.render('successnhomdich', { message: 'xóa thể loại thành công' })
    } else {
      res.render('successadmin', { message: 'xóa thể loại thành công' })
    }
  } catch (error) {
    console.error('Lỗi khi xóa thể loại:', error)
    res.status(500).json({ message: 'Đã xảy ra lỗi khi xóa thể loại.' })
  }
})

router.post('/categorydeletenew/:_id', async (req, res) => {
  try {
    const categoryId = req.params._id

    const deletedCategory = await Category.findById(categoryId)

    if (!deletedCategory) {
      return res.status(404).json({ message: 'thể loại không tồn tại.' })
    }
    const manga = await Manga.find({ category: deletedCategory.categoryname })
    manga.forEach(cate => {
      cate.category = 'Đang cập nhật'
    })
    await Promise.all(manga.map(cate => cate.save()))

    await deletedCategory.deleteOne()
    res.json({ message: 'Xóa thể loại thành công' })
  } catch (error) {
    console.error('Lỗi khi xóa thể loại:', error)
    res.status(500).json({ message: 'Đã xảy ra lỗi khi xóa thể loại.' })
  }
})

module.exports = router
