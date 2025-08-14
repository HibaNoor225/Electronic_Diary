const rateLimit = require('express-rate-limit');

class limit{

loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5,                   
  message: 'Too many login attempts. Try again after 15 minutes.'
});



limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,                 
  message: 'Too many requests, try again later.', 
});

}
module.exports=new limit()