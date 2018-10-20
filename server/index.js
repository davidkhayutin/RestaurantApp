
const express = require('express');
const app = express();
const PORT = 8080;
const bodyParser = require('body-parser');
const cookieSession = require('cookie-session');
const accountSid = 'AC3fd0f60292368f6415acd32dbca3b9c9';
const authToken = '2c9bd5dc5aef8d1295dd734ac27dda2a';
const twilio= require('twilio')(accountSid, authToken);
const knexConfig = require('../knexfile').development;
const knex = require('knex')(knexConfig);
const {Client} = require('pg');
const client = new Client({
  database: 'restaurant_app'
});

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static('public'));


// twilio.messages.create(
//   {
//     to: '+16044410372',
//     from: '+16042655347',
//     body: 'You just added a new item to your cart!',
//   },
//   (err, message) => {
//     console.log(message.sid);
//   }
// );


function getCartLineItem(itemId,userId){
  return knex('cart_line_items')
  .select('id')
  .where({
    menu_items_id : itemId,
    users_id : userId
  })
  .limit(1)
}
// testing purposes:
// getCartLineItem(1,1)
// .then((result) => {
//   console.log(result[0].id);
//   console.log(typeof(result[0].id));
// })



function addToCart(itemId,userId,cb){
  return knex('cart_line_items')
  .insert({
    users_id: userId,
    menu_items_id : itemId
  }).then(() => {
    cb()
  })
}


function removeFromCart(itemId,userId,cb){
  return getCartLineItem(itemId,userId)
  .then((result) => {
    let tableId = result[0].id;
    knex('cart_line_items')
    .where('id',tableId)
    .del()
    .asCallback((err) => {
      cb();
    })
  })

}

function getCart(userId){
  return knex('cart_line_items')
  .join('menu_items', 'menu_items_id', '=', 'menu_items.id')
  .select('menu_items.id','menu_items.name','menu_items.avatar')
  .count('*')
  .sum('menu_items.price')
  .where({
    users_id: userId
  })
  .groupBy('menu_items.id')
  .asCallback((err,result) => {
   return result;
  })
}

function getCartItems(userId){
  return knex('cart_line_items')
  .join('menu_items','menu_items_id', '=', 'menu_items.id')
  .select('menu_items.id')
  .where({
    users_id: userId
  })
  .asCallback((err,result) => {
    return result;
  })

}


app.post("/removeFromCart", (req,res) => {
  let itemId = Number(req.body.item_id)
  let userId = 1;

  removeFromCart(itemId,userId,() => {
    getCart(userId)
    .then((cart) => {
      res.status(201);
      res.json({cart: cart})
    })
  });

})

app.post("/addToCart", (req,res) => {
  let itemId = req.body.item_id;
  let userId = 1;
  addToCart(itemId,userId,() => {
    getCart(userId)
    .then((cart) => {
      res.status(201);
      res.json({cart: cart})
    })

  });
});


app.post("/addToOrder", (req,res) => {
  let userId = 1;
  getCartItems(userId)
  .then((result) => {

    knex('customer_orders')
    .returning('customer_orders.id')
    .insert({
      users_id : userId
    })
    .then((orderId) => {
      result.forEach((item) => {
        knex('order_line_items')
        .insert({
          customer_orders_id : orderId[0],
          menu_items_id : item.id
        })
        .then(() => {
          res.status(201).end();
        })
      })
    })
    .then(() => {
      knex('cart_line_items')
      .where('users_id','=',`${userId}`)
      .del()
      .asCallback();
    })
  })
});


//function which queiries database and saves menu items
function loadMenuItems(){
  return knex('menu_items')
  .select('*')
  .then((data) =>{
   return data;
  })
}


//saves items from database and makes them available client side
app.get("/items",function(req,res){
  loadMenuItems()
    .then((cart) => {
      res.status(200);
      res.json({menu: cart})
    })
});








//function which queiries database and saves new order
function loadOrder(){
  return knex('order_line_items')
  .join('customer_orders', 'customer_orders_id', '=', 'customer_orders.id')
  .join('menu_items','menu_items_id', '=', 'menu_items.id')
  .join('users','users_id','=','users.id')
  .select('users.name','users.phone','menu_items.name','menu_items.price')
  .count('*')
  .groupBy('menu_items.name', 'users.name', 'users.phone', 'menu_items.price')
  .asCallback()
}

loadOrder()
.then((result) => {
  console.log(result);
})



// //saves order from database and makes them available client side
// app.get("/orderPlaced",(req, res) =>{
//   loadOrder()
//     .then((items) =>{
//       console.log(items)
//       // res.status(200);
//       // res.json({order: items})
//     })
// })














app.listen(PORT, () => {
    console.log(`Example app listening on port ${PORT}!`);
});

