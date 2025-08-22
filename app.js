const express=require("express")
const app=express()
require('dotenv').config();
const authRoutes=require("./Routes/authRoutes.js")
const connectDB = require('./config/db');
const path = require("path");
const sanitize = require('mongo-sanitize');
const limit=require('./utils/limiter.js')
const passport=require('./config/passport'); 
const diaryRoutes = require('./Routes/diaryRoutes');
const postRoutes=require("./Routes/postRoutes");
const userRoutes = require('./Routes/userRoutes');
const CategoryMoodRoutes=require("./Routes/CategoryMoodRoutes.js")
const suggestionRoutes=require("./Routes/suggestions.js")
const chatRoutes = require('./Routes/chatRoutes'); // new



const seedAdminAndData=require("./seedAdmin.js")
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/HTML', express.static(path.join(__dirname, 'HTML')));
app.use(passport.initialize());


connectDB()
seedAdminAndData();



app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'HTML', 'register_login.html'));
});
app.use(limit.limiter)
app.use((req, res, next) => {
  console.log(` ${new Date().toString()}   ${req.method} ${req.url}`);
  next(); 
});

// Middleware to sanitize all incoming data
app.use((req, res, next) => {
  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);
  next();
})

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, 'HTML'))); 
app.use(express.json())


const adminRoutes=require("./Routes/adminRoutes.js")
app.use("/auth",authRoutes)
app.use('/api/diary', diaryRoutes);
app.use("/api/posts",postRoutes);
app.use('/api/users', userRoutes);
app.use('/api', CategoryMoodRoutes);
app.use('/api/suggestions', suggestionRoutes);
app.use('/api/admin',adminRoutes)
app.use('/chat/api', chatRoutes); // correct





// Error handler 
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(500).json({
    result: "failure",
    message: err.message,
    data: null
  });
});

//For invalid requests
app.use((req, res) => {
  res.status(404).json({
    result: "failure",
    message: "Route not found",
    data: null
  });
});



module.exports=app