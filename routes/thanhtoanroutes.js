const router = require('express').Router()
const User = require('../models/UserModel')
const paypal = require('paypal-rest-sdk')
const moment = require('moment')
const momenttimezone = require('moment-timezone')
const Payment = require('../models/PaymentModel')

paypal.configure({
  mode: 'live',
  client_id:
    'AXVdpjuiIVdfBGFqRA6k-mJVl3A-ZU4Z2hgnXnOUKfx1FMdvN75esad5Qc8l799qBT9CgGvvSBSShXMv',
  client_secret:
    'EM-ZdY6iJkCCb2Y0YUXPlV3h5txunkGGhzqHh9HFbvpIER95XMCFuTxQ3axG4pK49p0w_cDnwhvHAmpf'
})

router.post('/pay/:_userId', async (req, res) => {
  try {
    const { totalAmount, currency } = req.body
    const userId = req.params._userId
    let coin = totalAmount * 10
    const success = 'đợi thanh toán'
    const vietnamTime = momenttimezone().add(7, 'hours').toDate()
    const paymentData = new Payment({
      userID: userId,
      currency: currency,
      totalAmount: totalAmount,
      coin: coin,
      date: vietnamTime,
      success: success
    })

    const createPaymentJson = {
      intent: 'sale',
      payer: {
        payment_method: 'paypal'
      },
      transactions: [
        {
          amount: {
            total: totalAmount,
            currency: currency
          }
        }
      ],
      redirect_urls: {
        return_url: `http://du-an-2023.vercel.app/success/${paymentData._id}`,
        cancel_url: `http://du-an-2023.vercel.app/cancel`
      }
    }

    const user = await User.findById(userId)

    paypal.payment.create(createPaymentJson, async (error, payment) => {
      if (error) {
        // Bắt lỗi và trả về response 500
        console.error('Lỗi khi tạo thanh toán:', error)
        return res
          .status(500)
          .json({ error: 'Đã xảy ra lỗi khi tạo thanh toán.' })
      } else {
        for (let i = 0; i < payment.links.length; i++) {
          if (!user) {
            // Trả về response 500 nếu không tìm thấy người dùng
            return res.status(500).json('Không tìm thấy người dùng')
          } else {
            if (payment.links[i].rel === 'approval_url') {
              await paymentData.save()
              user.payment.push(paymentData._id)
              await user.save()
              // Trả về URL để chuyển hướng đến trang thanh toán PayPal
              return res.json(payment.links[i].href)
            }
          }
        }
      }
    })
  } catch (error) {
    console.error('Lỗi khi xử lý thanh toán:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi xử lý thanh toán.' })
  }
})

router.get('/success/:id', async (req, res) => {
  try {
    const payerId = req.query.PayerID
    const paymentId = req.query.paymentId
    const id = req.params.id
    let success = 'thanh toán thành công'

    const executePaymentJson = {
      payer_id: payerId
    }

    paypal.payment.execute(
      paymentId,
      executePaymentJson,
      async (error, payment) => {
        if (error) {
          console.error(error.response)
          throw error
        } else {
          const updatePayment = await Payment.findOneAndUpdate(
            { _id: id },
            { success: success },
            { new: true }
          )

          if (!updatePayment) {
            res.status(404).json({ message: 'Không tìm thấy thanh toán.' })
          }
          const totalAmount = updatePayment.totalAmount
          const userId = updatePayment.userID

          const user = await User.findById(userId)
          const updatedCoin = totalAmount * 10 + (user.coin || 0)

          await User.findOneAndUpdate(
            { _id: userId },
            { coin: updatedCoin },
            { new: true }
          )

          res.render('successthanhtoan', {
            message: 'Thanh toán thành công mời quay trở lại app!'
          })
        }
      }
    )
  } catch (error) {
    console.error('Lỗi khi xử lý thanh toán:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi xử lý thanh toán.' })
  }
})

router.get('/paymentdetail/:userid', async (req, res) => {
  try {
    const userid = req.params.userid
    const user = await User.findById(userid)
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' })
    }
    const paymentDetails = await Payment.find({
      userID: userid,
      success: 'thanh toán thành công'
    })

    if (!paymentDetails || paymentDetails.length === 0) {
      return res
        .status(404)
        .json({ message: 'Không tìm thấy thông tin thanh toán' })
    }

    // Phản hồi với dữ liệu theo cấu trúc mô hình
    const formattedPaymentDetails = paymentDetails.map(paymentDetail => {
      const formattedDate = moment(paymentDetail.date).format(
        'DD/MM/YYYY HH:mm:ss'
      )
      return {
        userID: paymentDetail.userID,
        currency: paymentDetail.currency,
        totalAmount: paymentDetail.totalAmount,
        coin: paymentDetail.coin,
        date: formattedDate,
        success: paymentDetail.success
      }
    })

    res.json(formattedPaymentDetails)
  } catch (error) {
    console.error('Lỗi lấy lịch sử giao dịch:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi lấy lịch sử giao dịch.' })
  }
})

router.get('/getrevenue', async (req, res) => {
  try {
    const startDate = req.query.startDate
    const endDate = req.query.endDate

    // Thực hiện truy vấn dựa trên khoảng ngày
    const payments = await Payment.find({
      success: 'thanh toán thành công',
      date: { $gte: startDate, $lte: endDate }
    })
    res.json(payments)
  } catch (error) {
    console.error('Đã xảy ra lỗi:', error)
    res.status(500).json({ message: 'Đã xảy ra lỗi.' })
  }
})

router.get('/cancel', (req, res) => {
  res.render('successthanhtoan', {
    message: 'Thanh toán đã bị hủy mời quay trở lại app!'
  })
})

router.get('/topUsers', async (req, res) => {
  try {
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
          coin: user.totalAmount * 10
        }
      })
    )

    res.json(extendedTopUsers)
  } catch (error) {
    console.error('Lỗi khi lấy top người dùng:', error)
    res.status(500).json({ error: 'Đã xảy ra lỗi khi lấy top người dùng' })
  }
})

module.exports = router
