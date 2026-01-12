const express = require('express')
const mongoose = require('mongoose')
const bodyParser = require('body-parser')
const session = require('express-session')
const {
  allowInsecurePrototypeAccess
} = require('@handlebars/allow-prototype-access')
const Handelbars = require('handlebars')
const hbs = require('express-handlebars')
const methodOverride = require('method-override')
const path = require('path')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const MongoStore = require('connect-mongo')
const handle = require('./routes/hbs')
const baiviet = require('./routes/baivietroutes')
const category = require('./routes/categoryroutes')
const manga = require('./routes/mangaroutes')
const chapter = require('./routes/chapterroutes')
const thanhtoan = require('./routes/thanhtoanroutes')
const notification = require('./routes/notificationroutes')
const thongtinadmin = require('./routes/thongtinadminroutes')
const thongtinuser = require('./routes/thongtinuser')

var app = express()

app.engine(
  '.hbs',
  hbs.engine({
    extname: 'hbs',
    defaultLayout: false,
    layoutsDir: 'views/layouts/',
    handlebars: allowInsecurePrototypeAccess(Handelbars),
    helpers: {
      range: function (from, to) {
        const result = []
        for (let i = from; i <= to; i++) {
          result.push(i)
        }
        return result
      },
      isEqual: function (a, b) {
        return a === b
      }
    }
  })
)

app.set('view engine', '.hbs')
app.set('views', path.join(__dirname, 'views'))
app.use(methodOverride('_method'))

const uri =
  'mongodb+srv://ducbinhnguyennd:apptruyen123@cluster0.sck9o.mongodb.net/apptruyen?retryWrites=true&w=majority'

mongoose
  .connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(console.log('kết nối thành công'))

const mongoStoreOptions = {
  mongooseConnection: mongoose.connection,
  mongoUrl: uri,
  collection: 'sessions' // Tên collection lưu trữ session trong MongoDB
}

app.use(cookieParser())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(
  session({
    secret: 'mysecretkey',
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create(mongoStoreOptions),
    cookie: {
      secure: false
    }
  })
)
app.use(cors())
app.use(express.static(path.join(__dirname, '/uploads')))


app.use('/', handle)
app.use('/', baiviet)
app.use('/', category)
app.use('/', manga)
app.use('/', chapter)
app.use('/', thanhtoan)
app.use('/', notification)
app.use('/', thongtinadmin)
app.use('/', thongtinuser)

app.listen(8080, () => {
  try {
    console.log('kết nối thành công 8080')
  } catch (error) {
    console.log('kết nối thất bại 8080', error)
  }
})
