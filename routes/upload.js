const multer = require('multer')
const path = require('path')
const pathToUploads = path.resolve(__dirname, '../uploads')

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, pathToUploads)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + path.extname(file.originalname)
    cb(null, file.fieldname + '-' + uniqueSuffix)
  }
})

const upload = multer({ storage: storage })

module.exports = upload
