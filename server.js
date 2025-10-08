const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - body parser limitini oshirish
app.use(express.json({ limit: '50mb' })); // 50MB gacha ruxsat berish
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));
app.use(session({
  secret: 'nakrutka-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 kun
}));

// MongoDB ulanishi
mongoose.connect('mongodb+srv://refbot:refbot00@gamepaymentbot.ffcsj5v.mongodb.net/nak2?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// MongoDB schema
const orderSchema = new mongoose.Schema({
  sessionId: String,
  category: String,
  service: String,
  profileUrl: String,
  quantity: Number,
  amount: Number,
  paymentScreenshot: String,
  status: { type: String, default: 'pending' }, // pending, approved, rejected
  createdAt: { type: Date, default: Date.now }
});

const serviceSchema = new mongoose.Schema({
  category: String,
  name: String,
  price: Number,
  createdAt: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);
const Service = mongoose.model('Service', serviceSchema);

// Middleware sessionId ni sozlash
app.use((req, res, next) => {
  if (!req.session.sessionId) {
    req.session.sessionId = generateSessionId();
  }
  next();
});

// Bosh sahifa
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Admin sahifasi
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API - barcha servislarni olish
app.get('/api/services', async (req, res) => {
  try {
    const services = await Service.find();
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: 'Servis ma\'lumotlarini olishda xato' });
  }
});

// API - kategoriya bo'yicha servislarni olish
app.get('/api/services/:category', async (req, res) => {
  try {
    const services = await Service.find({ category: req.params.category });
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: 'Servis ma\'lumotlarini olishda xato' });
  }
});

// API - yangi buyurtma yaratish
app.post('/api/orders', async (req, res) => {
  try {
    const { category, service, profileUrl, quantity, amount, paymentScreenshot } = req.body;
    
    // Screenshot hajmini tekshirish va optimallashtirish
    let optimizedScreenshot = paymentScreenshot;
    if (paymentScreenshot && paymentScreenshot.length > 1000000) { // 1MB dan katta bo'lsa
      // Base64 ma'lumotni qisqartirish (soddalashtirilgan versiya)
      optimizedScreenshot = await compressImage(paymentScreenshot);
    }
    
    const newOrder = new Order({
      sessionId: req.session.sessionId,
      category,
      service,
      profileUrl,
      quantity,
      amount,
      paymentScreenshot: optimizedScreenshot
    });
    
    await newOrder.save();
    res.json({ success: true, orderId: newOrder._id });
  } catch (error) {
    console.error('Buyurtma yaratish xatosi:', error);
    res.status(500).json({ error: 'Buyurtma yaratishda xato' });
  }
});

// API - session bo'yicha buyurtmalarni olish
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find({ sessionId: req.session.sessionId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Buyurtma ma\'lumotlarini olishda xato' });
  }
});

// API - admin uchun barcha buyurtmalarni olish
app.get('/api/admin/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Buyurtma ma\'lumotlarini olishda xato' });
  }
});

// API - admin uchun buyurtma statusini o'zgartirish
app.put('/api/admin/orders/:id', async (req, res) => {
  try {
    const { status } = req.body;
    await Order.findByIdAndUpdate(req.params.id, { status });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Buyurtma statusini yangilashda xato' });
  }
});

// API - admin uchun yangi servis qo'shish
app.post('/api/admin/services', async (req, res) => {
  try {
    const { category, name, price } = req.body;
    
    const newService = new Service({
      category,
      name,
      price
    });
    
    await newService.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Servis qo\'shishda xato' });
  }
});

// API - admin uchun barcha servislarni olish
app.get('/api/admin/services', async (req, res) => {
  try {
    const services = await Service.find();
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: 'Servis ma\'lumotlarini olishda xato' });
  }
});

// API - admin uchun servisni o'chirish
app.delete('/api/admin/services/:id', async (req, res) => {
  try {
    await Service.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Servisni o\'chirishda xato' });
  }
});

// API - admin uchun servisni yangilash
app.put('/api/admin/services/:id', async (req, res) => {
  try {
    const { category, name, price } = req.body;
    await Service.findByIdAndUpdate(req.params.id, { category, name, price });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Servisni yangilashda xato' });
  }
});

// Rasmni siqish funksiyasi (soddalashtirilgan)
async function compressImage(base64String) {
  // Haqiqiy loyihada bu yerda rasmni siqish kutubxonasi ishlatiladi
  // Hozircha faqat ma'lumotni qaytaradi
  return base64String;
}

// SessionId yaratish funksiyasi
function generateSessionId() {
  return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
}

// Serverni ishga tushurish
app.listen(PORT, () => {
  console.log(`Server http://localhost:${PORT} da ishlamoqda`);
});