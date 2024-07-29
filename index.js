require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const ftp = require('basic-ftp');
const cron = require('cron');
const sqlite3 = require('sqlite3').verbose();
const mongoose = require('mongoose');

// Initialize the bot with token from environment variable
const token = process.env.TELEGRAM_BOT_TOKEN || process.env['TELEGRAM_BOT_TOKEN'];
const bot = new TelegramBot(token, { polling: true });
let checkInRate = 0.02;

const mongoURI = process.env.MONGODB_URI || process.env['MONGODB_URI'];

// MongoDB connection (commented out)
// mongoose.connect(mongoURI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// })
// .then(() => {
//   console.log('MongoDB connected');
// })
// .catch((err) => {
//   console.error('MongoDB connection error:', err);
// });

// Connect to the SQLite database
let db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('Error connecting to the database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// FTP configuration
const FTP_HOST = process.env.FTP_HOST;
const FTP_USER = process.env.FTP_USER;
const FTP_PASS = process.env.FTP_PASS;
const REMOTE_FILE_PATH = './checkin_remotedb/remotedb.db';
const LOCAL_FILE_PATH = './database.db';
const LOCAL_FILE_PATH_2 = './remotedb.db';

// Function to download the remote file
async function downloadFile() {
    const client = new ftp.Client();
    try {
        await client.access({
            host: FTP_HOST,
            user: FTP_USER,
            password: FTP_PASS,
            secure: false
        });
        await client.downloadTo(LOCAL_FILE_PATH_2, REMOTE_FILE_PATH);
        console.log('Remote file downloaded successfully.');
    } catch (err) {
        console.error('Download failed:', err);
    } finally {
        client.close();
    }
}

// Function to upload the file to the remote server
async function uploadFile() {
    const client = new ftp.Client();
    try {
        await client.access({
            host: FTP_HOST,
            user: FTP_USER,
            password: FTP_PASS,
            secure: false
        });
        await client.uploadFrom(LOCAL_FILE_PATH_2, REMOTE_FILE_PATH);
        console.log('Updated file uploaded successfully.');
    } catch (err) {
        console.error('Upload failed:', err);
    } finally {
        client.close();
    }
}

// Function to synchronize files
async function syncFiles() {
    try {
        await downloadFile();  // Download the latest remote file
        
        // Copy local file contents to the remote file
        fs.copyFileSync(LOCAL_FILE_PATH, LOCAL_FILE_PATH_2);
        // fs.copyFileSync(LOCAL_FILE_PATH + '.temp', LOCAL_FILE_PATH);
        // fs.unlinkSync(LOCAL_FILE_PATH + '.temp');
        
        await uploadFile();    // Upload the updated file back to the remote server
    } catch (err) {
        console.error('Sync failed:', err);
    }
}

// Sync every 5 hours
const syncJob = new cron.CronJob('*/30 * * * *', syncFiles);  // Runs every 30 mins
syncJob.start();

// Run the sync process immediately on startup
syncFiles();


// Initialize MongoDB and SQLite connections here if needed

// Create the users table if it doesn't exist
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER UNIQUE,
    user_name TEXT NOT NULL,
    user_s_n INTEGER PRIMARY KEY AUTOINCREMENT, 
    user_firstname TEXT NOT NULL,
    user_lastname TEXT NOT NULL,
    user_referral INTEGER DEFAULT 0,
    user_downlines INTEGER DEFAULT 0,
    user_points INTEGER DEFAULT 0,
    tg_channel INTEGER DEFAULT 0,
    tg_community INTEGER DEFAULT 0,
    x_follow INTEGER DEFAULT 0,
    reward_received INTEGER DEFAULT 0,
    daily_reward INTEGER DEFAULT 0,
    ton_balance INTEGER DEFAULT 0,
    gas_fee_verify INTEGER DEFAULT 0,
    ton_wallet TEXT DEFAULT 0
  )
`, (err) => {
  if (err) {
    console.error('Error creating users table:', err.message);
  } else {
    console.log('Users table created.');
  }
});

db.run(`CREATE TABLE IF NOT EXISTS transaction_history (
id INTEGER PRIMARY KEY AUTOINCREMENT,
user_id INTEGER NOT NULL,
transaction_hash TEXT NOT NULL,
transaction_amount INTEGER NOT NULL,
transaction_type TEXT NOT NULL,
transaction_status TEXT NOT NULL,
transaction_datetime TEXT NOT NULL)
  `, (err) =>{
  if (err) {
    console.error('Error creating transaction_history table:', err.message);
  } else {
    console.log('transaction_history table created.');
  }

  })

// Keyboard layout for general options
const generalKeyboard = {
  parse_mode: 'Markdown',
  reply_markup: {
    keyboard: [
      [{ text: "🛠️ PROFILE" }],
      [{ text: "🎉 CLAIM DAILY BONUS" }, { text: "🔗 REFERRAL" }],
      [ { text: "BALANCE 💰" }, { text: "➕ MORE " }]
    ],
    resize_keyboard: true
  }
};

// Keyboard layout for more keyboard 
const moreKeyboard = {
  parse_mode: 'Markdown',
  reply_markup: {
    keyboard: [
      [{text: "💰 COMMUNITY BONUS"}, {text: "SWAP 🔄"}],
      [{ text: "🔙 BACK" }]
    ],
    resize_keyboard: true
  }
};

// Keybord layout for swap keyboard

const swapKeyboard = {
  parse_mode: 'Markdown',
  reply_markup: {
    keyboard: [
      [{text: "CHECKIN 🔄 TON"}, {text: "TON  🔄 CHECKIN"}],
      [{text: "TOPUP TON 💎"}, {text: "SET TON 💎 WALLET"}],
      [{ text: "BACK 🔙"}, {text: "WITHDRAW TON  💎"}]
    ],
    resize_keyboard: true
  }
};
// Function to handle new user creation
function createUser(userId, username, firstName, lastName, referral) {
  const insertUser = `INSERT INTO users (user_id, user_name, user_firstname, user_lastname, user_referral) VALUES (?, ?, ?, ?, ?)`;
  db.run(insertUser, [userId, username, firstName, lastName, referral], (err) => {
    if (err) {
      console.error('Error inserting new user:', err.message);
    } else {
      console.log(`New User Added: ${userId}, Username: ${username}, First Name: ${firstName}, Last Name: ${lastName}`);
    }
  });
}

const job = new cron.CronJob('0 0 0 * * *', () =>{
  db.run(`UPDATE users SET daily_reward = 0`, (err) => {
    if (err) {
      console.error('Error updating daily_reward:', err.message);
    } else {
      console.log('daily_reward updated successfully.');
    }
  });
});
job.start();
// Function to handle existing user
function handleExistingUser(chatId, username) {
  bot.sendMessage(chatId, `Dear ${username}, You already have an account.\n\nCheckIn is a platform that provides users with various ways to earn money. The platform offers multiple earning opportunities, including claiming bonuses, solving captchas, referrals, and watching paid ads.\n Here's a step-by-step breakdown of how users can make money on CheckIn using these methods:\n\n1. Earn through Claiming Bonus:\n-On our platform, users have the opportunity to receive bonuses by claiming them every 24 hours.\n2. Earn through Referrals:\n-CheckIn has a referral program that allows users to earn money by referring new users to our platform.\n3. One-Time Joining Bonus:\n-Each user can claim a one-time 150✅ CheckIn Token bonus after joining our channel.\n\nBelow are available Options For you 👇.`, generalKeyboard);
}



// Function to handle user onboarding
function handleUserOnboarding(chatId, firstName, referral) {
db.run(`UPDATE users SET user_downlines = user_downlines + 1 WHERE user_id = ?`, [referral], (err) => {
  if (err) {
    console.error('Error updating user_downlines:', err.message);
  } else {
    db.run(`UPDATE users SET user_points = user_points + 100 WHERE user_id = ?`, [referral],(err2)=>{
      if(err2){
        console.error('Error updating user_points:', err2.message);
      }else{
        bot.sendMessage(referral, `🎉 Congratulations!\nUser ${firstName} joined through your link.\nYou have earned additional 100 CheckIn Tokens`);
        //console.log('user_points updated successfully.');
      }
    })
    //console.log('user_downlines updated successfully.');
  }
});
  bot.sendMessage(chatId, `Dear ${firstName}, Referred by ${referral},\n\nCheckIn is a platform that provides users with various ways to earn money. The platform offers multiple earning opportunities, including claiming bonuses, solving captchas, referrals, and watching paid ads.\n Here's a step-by-step breakdown of how users can make money on CheckIn using these methods:\n\n1. Earn through Claiming Bonus:\n-On our platform, users have the opportunity to receive bonuses by claiming them every 24 hours.\n2. Earn through Referrals:\n-CheckIn has a referral program that allows users to earn money by referring new users to our platform.\n3. One-Time Joining Bonus:\n-Each user can claim a one-time 150 CheckIn Token bonus after joining our channel.\n\nReady To Proceed? Click continue Below 👇`, {
    reply_markup: {
      inline_keyboard: [
        [{
          text: 'Continue',
          callback_data: 'continue'
        }]
      ]
    }
  });
}

//LISTEN FOR TESTINSERTCHECKIN 
bot.onText(/TESTINSERTCHECKIN/, (msg)=>{
  const chatId = msg.chat.id;
  db.run(`UPDATE users SET user_points = user_points + 100 WHERE user_id = ?`, [chatId], (err)=>{
    bot.sendMessage(chatId, `TESTINSERTCHECKIN`);
  });
});

//LISTEN FOR TESTINSERTTON
bot.onText(/TESTINSERTTON/, (msg)=>{
  const chatId = msg.chat.id;
  db.run(`UPDATE users SET ton_balance = ton_balance + 3 WHERE user_id = ?`, [chatId], (err)=>{
    bot.sendMessage(chatId, `TON Balance Updated Successfully`);
  });
});

//LISTEN FOR TESTINSERTTON
bot.onText(/TESTINSERTDL/, (msg)=>{
  const chatId = msg.chat.id;
  db.run(`UPDATE users SET user_downlines = user_downlines + 2 WHERE user_id = ?`, [chatId], (err)=>{
    bot.sendMessage(chatId, `User Down lines Updated Successfully`);
  });
});


// Listen for /start command
bot.onText(/\/start(.+)?/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  let username = msg.from.username || "Telegram User";
  const firstName = msg.from.first_name || "Telegram";
  const lastName = msg.from.last_name || "User";
  let startPayload = match[1] ? match[1].trim() : "6217166646"; // Default referral if none is provided

  // Check if the user already exists
  db.get(`SELECT * FROM users WHERE user_id = ?`, [userId], (err, row) => {
    if (err) {
      console.error('Error querying users table:', err.message);
    } else if (row) {
      handleExistingUser(chatId, username);
    } else {
      createUser(userId, username, firstName, lastName, startPayload);
      handleUserOnboarding(chatId, firstName, startPayload);
    }
  });
});

//LISTEN FOR PROFILE COMMAND
bot.onText(/🛠️ PROFILE/, (msg) =>{
  const chatId = msg.chat.id;
  db.get(`SELECT * FROM users WHERE user_id = ?`, [chatId], (err, row) =>{
    if (err) {
      console.error('Error querying users table:', err.message);
      bot.sendMessage(chatId, 'Sorry, there was an error retrieving your profile. Please try again later.');
      return;
    }
    if (row){
      bot.sendMessage(chatId, `Your Profile Details: \n\n👤 Name: ${row.user_firstname} ${row.user_lastname}\n🆔 User ID: ${row.user_id}\n💰CheckIn Balance: ${row.user_points} CheckIn Tokens (≈${((row.user_points)*checkInRate).toFixed(2)} TON)\n💎TON Balance: ${row.ton_balance} TON\n👥 Referrals: ${row.user_downlines}\n🔗 Referral Link: https://t.me/CheckInCash_Bot?start=${row.user_id}`);
    }
  }); 
});

//listen to 🎉 CLAIM DAILY BONUS command
bot.onText(/🎉 CLAIM DAILY BONUS/, (msg) =>{
  const chatId = msg.chat.id;
  db.get(`SELECT * FROM users WHERE user_id = ?`, [chatId], (err, row) =>{
    if (err) {
      console.error('Error querying users table:', err.message);
      bot.sendMessage(chatId, 'Sorry, there was an error retrieving your profile. Please try again later.');
      return;
    }
    if (row){
      if (row.daily_reward == 0){
        bot.sendMessage(chatId, `Congratulations🎉! You have claimed your daily bonus of 15 CheckIn Tokens.`);
        db.run(`UPDATE users SET daily_reward = 1 WHERE user_id = ?`, [chatId], (err) => {
          if (err) {
            
            console.error('Error updating daily_reward:', err.message);
          } else {
            db.run(`UPDATE users SET user_points = user_points + 15 WHERE user_id = ?`, [chatId], (err7) =>{
              if(err7){
                console.error('Error updating user_points:', err7.message);
              }
              
            });
            console.log('daily_reward updated successfully.');
          }
        });
      }
      else{
        bot.sendMessage(chatId, `You have already claimed your daily bonus. Please try again tomorrow.`);
      }
    }
  });
})

// Listen for referral command
bot.onText(/🔗 REFERRAL/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `🔥 CheckIn Airdrop Is Live!\n\n🎁Joining Reward: 150 CheckIn Tokens\n\n👨‍👨‍👦 Per Refer: 100 CheckIn Tokens\n\n🔗 Your Referral Link: https://t.me/CheckInCash_Bot?start=${msg.from.id}`);
}); 

// Listen for claiming startup bonus
bot.onText(/🎉 CLAIM STARTUP BONUS/, (msg) => {
  const chatId = msg.chat.id;

  db.get(`SELECT * FROM users WHERE user_id = ?`, [chatId], (err, row) => {
    if (err) {
      console.error('Error querying users table:', err.message);
      return;
    }
    if (row && row.reward_received === 0) {
      db.run(`UPDATE users SET reward_received = 1, user_points = user_points + 150 WHERE user_id = ?`, [chatId], (err) => {
        if (err) {
          console.error('Error updating user points:', err.message);
          return;
        }
        bot.sendMessage(chatId, `🎉 Congratulations @${row.user_name}! You have claimed your Startup Bonus of 150 CheckIn Token.\n*CURRENT BALANCE:* ${row.user_points + 150} (≈${(row.user_points + 150)*checkInRate} USDT)\n\nExplore and Enjoy 🚀`, generalKeyboard);
      });
    } else {
      bot.sendMessage(chatId, 'You have already received your *reward.*', generalKeyboard);
    }
  });
});



// Listen for balance command
bot.onText(/BALANCE 💰/, (msg) => {
  const chatId = msg.chat.id;

  db.get(`SELECT user_points FROM users WHERE user_id = ?`, [chatId], (err, row) => {
    if (err) {
      console.error('Error querying users table:', err.message);
      bot.sendMessage(chatId, 'Sorry, there was an error retrieving your balance. Please try again later.');
      return;
    }
    if (row) {
      bot.sendMessage(chatId, `*Your current balance is:* ${row.user_points} CheckIn Tokens (≈${((row.user_points)*checkInRate).toFixed(2)} TON)`, generalKeyboard);
    } else {
      bot.sendMessage(chatId, 'Sorry, we could not find your balance. Please try again later.');
    }
  });
}); 

// Listen for more command
bot.onText(/➕ MORE/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `👇 Choose an option below 👇`, moreKeyboard);
});

// LISTEN FOR COMMUNITY BONUS
bot.onText(/💰 COMMUNITY BONUS/, (msg) =>{
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `To Claim this bonus, Kindly Send /CheckIn In This Group: @CHECKIN_REWARD\n\nYou can always claim this bonus every 1 hour.`);
});
// LISTEN FOR SWAP COMMAND
bot.onText(/SWAP 🔄/, (msg) =>{
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `👇 Choose an option below 👇`, swapKeyboard);
  /*db.get(`SELECT * FROM users WHERE user_id = ?`, [chatId], (err, row) =>{
    if(err){
      console.error('Error querying users table:', err.message);
      bot.sendMessage(chatId, 'Sorry, there was an error. Try again Later');
      return;
    } 
    if(row){
      if(row.user_points >= 1000)
    }
  })*/
}
          );

//Listen CheckIn to Ton button
bot.onText( /CHECKIN 🔄 TON/, (msg) =>{
  const chatId = msg.chat.id;
  db.get(`SELECT * FROM users WHERE user_id = ?`, [chatId], (err, row) =>{
    if(err){
      console.error('Error querying users table:', err.message);
      bot.sendMessage(chatId, 'Sorry, there was an error. Try again Later');
      return;
    } 
    if(row){
      if(row.user_points >= 1000){
        if(row.user_downlines >= 5){
          if(row.ton_balance >= 3) {
            bot.sendMessage(chatId, `Are you sure you want to convert your CHECKIN to TON? Clicking Yes will deduct 1000 TON from your balance and Your checkIn will be credited. (1000 CheckIn = ${1000*checkInRate} TON)`,  {
    reply_markup: {
      inline_keyboard: [
        [{
          text: 'Yes',
          callback_data: 'confirmTrsct2'
        }, {
          text: 'No',
          callback_data: 'transactionCancel'
        }]
      ]
    }
          })
          }else{
            bot.sendMessage(chatId, `Sorry! You don't have enough TON Balance to swap. A minimum of 3 TON Should be available in your wallet before swapping. Kindly deposit more TON to your wallet.`);
          }
            
        }else {
          bot.sendMessage(chatId, `You need at least 5 downlines before you can swap CheckIn to TON`);
        }
      }else {
        bot.sendMessage(chatId, `You need at least 1000 CheckIn Tokens to Swap.\n\nCURRENT BALANCE: ${row.user_points} CheckIn Tokens`);
      }
    } else{
      bot.sendMessage(chatId, `You need to create an account first.`);
    }
  })
});
//Listen TOPUP TON button
bot.onText( /TOPUP TON 💎/, (msg) =>{
  const chatId = msg.chat.id;
  db.get(`SELECT * FROM users WHERE user_id = ?`, [chatId], (err, row) =>{
    if(err){
      console.error('Error querying users table:', err.message);
      bot.sendMessage(chatId, 'Sorry, there was an error. Try again Later');
      return;
    } else {
    bot.sendMessage(chatId, `Your TON Balance: ${row.ton_balance} TON\n\nTo Topup your TON, Kindly send your TON Token to this address 👇 and you will be credited immediately after verification:\n`+`EQCNf27tpqndaNIEMPi7z3ttXVL8atP0RE2so3anxmhtA1xl`+`\n\nAfter sending your TON Token, Kindly send the transaction hash here in this format for verification:\n\nVERIFYTRANSACTION
Transaction Hash:
4b8e4f2f6c1b4c5a9d3b1d5a6e7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a
Amount:
4\n\nNOTE: Only send TON (TON) network assets to this address. Other assets will be lost forever 👇.`, {parseMode: 'Markdown'});
    bot.sendMessage(chatId, `EQCNf27tpqndaNIEMPi7z3ttXVL8atP0RE2so3anxmhtA1xl`, {
    reply_markup: {
      inline_keyboard: [
        [{
          text: 'Sent',
          callback_data: 'tokensent'
        }]
      ]
    }
    });
  }
  });
});

//LISTEN FOR TON 🔄 CHECKIN
bot.onText(/TON  🔄 CHECKIN/, (msg) =>{
  const chatId = msg.chat.id;
  db.get(`SELECT * FROM users WHERE user_id = ?`, [chatId], (err, row)=>{
    if(err){
      console.error('Error querying users table:', err.message);
      bot.sendMessage(chatId, 'Sorry, there was an error. Try again Later');
      return;
    }else{
      if(row){
        bot.sendMessage(chatId, `Are you sure you want to convert your TON to CheckIn? Clicking Yes will deduct 2 TON from your balance and Your checkIn will be credited. (2 TON = 100 CheckIn)\n\nCURRENT TON BALANCE: ${row.ton_balance} TON\nCURRENT CHECKIN BALANCE: ${row.user_points} CheckIn`, {
    reply_markup: {
      inline_keyboard: [
        [{
          text: 'Yes',
          callback_data: 'confirmTrsct'
        }, {
          text: 'No',
          callback_data: 'transactionCancel'
        }]
      ]
    }
        });
      }
    }
  });
  
});

//listen for transaction hash in correct format
bot.on('message', (msg) =>{
  const chatId = msg.chat.id;
  const messageText = msg.text;
  const messageFormatRegex = /^VERIFYTRANSACTION\nTransaction Hash:\n[a-zA-Z0-9\-_=]{43,}\nAmount:\n\d+(\.\d{1,30})?$/;
  if (messageText.startsWith('VERIFYTRANSACTION')){
     // Extract transaction hash from the message
      const lines = messageText.split('\n');
      const transactionHash = lines[2]; 
    const amount = parseFloat(lines[4]);
    // Assuming transaction hash is on the 3rd line
    if (messageFormatRegex.test(messageText)){
      db.get('SELECT * FROM transaction_history WHERE transaction_hash = ?', [transactionHash], (err, row) =>{
        if(err){
          console.error('Error querying history table:', err.message);
          bot.sendMessage(chatId, 'Sorry, there was an error. Try again Later');
          return;
        }
        if(row){
      bot.sendMessage(chatId, `Transaction already exist.
      User ID: ${row.user_id}
      Status: ${row.transaction_status}
      Transaction Hash: ${row.transaction_hash}
      Amount: ${row.transaction_amount}`);
        } else {
          bot.sendMessage(chatId, `Transaction Verification request Submitted successfully.\n\nKindly wait 8 hours for the admin to verify your transaction.`);
bot.sendMessage(6217166646, `NEW DEPOSIT REQUEST\n\nUser ID: ${chatId}\nTransaction Hash: ${transactionHash}\nAmount: ${amount} TON\nDate: ${new Date().toISOString()}\n\nKindly verify the transaction and approve the deposit.`);
          db.run(`INSERT INTO transaction_history (user_id, transaction_hash, transaction_amount, transaction_type, transaction_status, transaction_datetime) VALUES (?, ?, ?, ?, ?, ?)`,[chatId, transactionHash, amount, 'TON_TOPUP', 'Pending', new Date().toISOString() ], (err)=>{
            if(err){
              console.error('Error inserting transaction history:', err.message);
              bot.sendMessage(chatId, 'Sorry, there was an error. Try again Later');
              return;
            }
          });
        }
      });  
      
      
    } else {
      bot.sendMessage(chatId, `Invalid transaction hash format. Please send the transaction hash in the correct format.`);
    }
  }else {
     
  }
   
});
//listen to SET TON WALLET BUTTON 
bot.onText(/SET TON 💎 WALLET/, (msg) =>{
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `Kindly Update your TON wallet address By sending in this format:\n\nSETTONWALLET
UQB9VUUvNEuX61LCiyRqV5txPUHZnIJMM-bUBOlozU1jTxgR`)
});

//listen to SETTONWALLET text format 
bot.on('message', (msg) =>{
  const chatId = msg.chat.id;
  if(msg.text.startsWith('SETTONWALLET')){
    const lines = msg.text.split('\n');
    const tonWalletAddress = lines[1];
    
      db.run(`UPDATE users SET ton_wallet = ? WHERE user_id = ?`, [tonWalletAddress, chatId], (err) => {
        if (err) {
          console.error('Error updating ton_wallet:', err.message);
          bot.sendMessage(chatId, 'Sorry, there was an error. Try again Later');
          return;
        } 
        bot.sendMessage(chatId, `TON Wallet Address Updated Successfully.`);
      });
    } else{
    
    }
    
  }
);

//listen for WITHDRAW TON 💎
bot.onText(/WITHDRAW TON  💎/, (msg) =>{
  const chatId = msg.chat.id;
  db.get(`SELECT * FROM users WHERE user_id = ?`, [chatId], (err, row)=>{
    if(err){
      console.error('Error querying users table:', err.message);
      bot.sendMessage(chatId, 'Sorry, there was an error. Try again Later');
      return;
    } else {
      if(row){
        if(row.ton_balance >= 20){
          if(row.ton_wallet !== null && row.ton_wallet !== '' && row.ton_wallet !== 0 && row.ton_wallet !== undefined){
            bot.sendMessage(chatId, `Are you sure you want to withdraw your TON into this wallet address?\n${row.ton_wallet}\n\nCURRENT TON BALANCE: ${row.ton_balance} TON`, {
    reply_markup: {
      inline_keyboard: [
        [{
          text: 'Yes',
          callback_data: 'confirmTrsct3'
        }, {
          text: 'No',
          callback_data: 'transactionCancel'
        }]
      ]
    }
            });
          }else {
            bot.sendMessage(chatId, `Kindly set your TON wallet address first.`);
          }
        } else{
          bot.sendMessage(chatId, `You need at least 20 TON to withdraw.`);
        }
      } else {
        bot.sendMessage(chatId, `You need to create an account first.`);
      }
    }
  })
});


// Listen for back button
bot.onText(/🔙 BACK/, (msg) =>{
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `👇 Choose an option below 👇`, generalKeyboard);
});
// Listen for back button
bot.onText(/BACK 🔙/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `👇 Choose an option below 👇`, moreKeyboard);
});

//listen for /CheckIn Message On Group -1002238223800 only 
bot.on('message', (msg) =>{
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if(chatId == -1002238223800){
    if(msg.text == '/CheckIn'){
function getRandomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
const randomNumber = getRandomNumber(5, 10);
      
      db.run(`UPDATE users SET user_points = user_points + ${randomNumber} WHERE user_id = ?`, [userId], (err2) => {
        if(err2){
          console.error('Error updating user_points:', err2.message);
        }
      }); 
      bot.sendMessage(userId, `👋 Hello @${msg.from.username}! You just claimed ${randomNumber} CheckIn Tokens from @CHECKIN_REWARD`)
    } else {
      bot.deleteMessage(chatId, msg.message_id);
    }
  
} else {
    
}
});

// Function to send the next step in the sequence
function sendNextStep(chatId, stepIndex) {
  const steps = [
    {
      text: 'STEP 1⃣ OF 3⃣\n\n📍Kindly Join CheckIn Community:',
      button: { text: 'Join Community', url: 'https://t.me/CheckInCom' },
      callback_data: 'joined_community'
    },
    {
      text: 'STEP 2⃣ OF 3⃣\n\n📍Now, Join CheckIn Telegram Channel:',
      button: { text: 'Join Channel', url: 'https://t.me/CheckInCash' },
      callback_data: 'joined_channel'
    },
    {
      text: 'STEP 3⃣ OF 3⃣\n\n📍Finally, Follow Us On Twitter:',
      button: { text: 'Follow on Twitter', url: 'https://x.com/CheckIn_On_X' },
      callback_data: 'followed_twitter'
    } 
  ];

  if (stepIndex < steps.length) {
    const step = steps[stepIndex];
    const opts = {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: step.button.text,
              url: step.button.url
            },
            {
              text: 'Next🟢',
              callback_data: step.callback_data
            }
          ]
        ]
      }
    };

    bot.sendMessage(chatId, step.text, opts);
  } else {
    // Check group membership status
    checkGroupMembership(chatId, '@CheckInCom', 'tg_community');
    checkGroupMembership(chatId, '@CheckInCash', 'tg_channel');

    // Add delay to allow for membership checks
    setTimeout(() => {
      db.get(`SELECT * FROM users WHERE user_id = ?`, [chatId], (err, row) => {
        if (err) {
          console.error('Error querying users table:', err.message);
          bot.sendMessage(chatId, 'Sorry, there was an error verifying your membership. Please try again later.');
          return;
        }
        if (row && row.tg_community === 1 && row.tg_channel === 1) {
          bot.sendMessage(chatId, `Welcome ${row.user_name}!\n\n You have been verified and your account has been credited with 150 CheckIn Tokens.\n\n Explore more to earn additional rewards!`, generalKeyboard);
          db.run(`UPDATE users SET user_points = user_points + 150, reward_received = 1 WHERE user_id = ?`, [chatId], (err) => {
            if (err) {
              console.error('Error updating user points:', err.message);
            }
          });
        } else {
          bot.sendMessage(chatId, `Hello *${row.user_name}*\n\nYou need to join both the community and channel to receive the rewards. Please complete the steps.`, {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: 'Retry Steps',
                    callback_data: 'retry_steps'
                  }
                ]
              ]
            }
          });
        }
      });
    }, 3000); // Adjust the delay if necessary
  }
}

// Function to check group membership status
function checkGroupMembership(chatId, groupId, column) {
  bot.getChatMember(groupId, chatId).then(member => {
    if (['member', 'administrator', 'creator'].includes(member.status)) {
      db.run(`UPDATE users SET ${column} = 1 WHERE user_id = ?`, [chatId], (err) => {
        if (err) {
          console.error(`Error updating ${column} status:`, err.message);
        }
      });
    } else {
      db.run(`UPDATE users SET ${column} = 0 WHERE user_id = ?`, [chatId], (err) => {
        if (err) {
          console.error(`Error updating ${column} status:`, err.message);
        }
      });
    }
  }).catch(err => {
    console.error(`Error checking group membership for ${column}:`, err.message);
  });
}

// Listen for callback queries
bot.on('callback_query', (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const callbackData = callbackQuery.data;

  switch (callbackData) {
    case 'continue':
      bot.deleteMessage(chatId, messageId);
      sendNextStep(chatId, 0);
      break;
    case 'joined_community':
      bot.deleteMessage(chatId, messageId);
      sendNextStep(chatId, 1);
      break;
    case 'joined_channel':
      bot.deleteMessage(chatId, messageId);
      sendNextStep(chatId, 2);
      break;
    case 'followed_twitter':
      bot.deleteMessage(chatId, messageId);
      sendNextStep(chatId, 3);
      break;
    case 'retry_steps':
      bot.deleteMessage(chatId, messageId);
      sendNextStep(chatId, 0);
      break; 
  }
  //Receive Transaction hash if format is correct and make sure any message that follows is in format of Transaction Hash
  if(callbackData == 'tokensent'){
    bot.deleteMessage(chatId, messageId);
    bot.sendMessage(chatId, `Please send your transaction hash here in this format:\n\nVERIFYTRANSACTION
Transaction Hash:
4b8e4f2f6c1b4c5a9d3b1d5a6e7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a
Amount:
4`, {parseMode: 'Markdown'});
  }else if(callbackData == 'confirmTrsct'){
    bot.deleteMessage(chatId, messageId);
    function convertingMessage(){
      bot.sendMessage(chatId, `Please wait while we are converting your TON to CheckIn.`);
    }
    function almostDone(){
      bot.sendMessage(chatId, `Hold on, Almost Done!`);
    }
    function done(){
      db.run(`UPDATE users SET ton_balance = ton_balance - 2 WHERE user_id = ?`, [chatId], (err) => {
        if (err) {
          console.error('Error updating ton_balance:', err.message);
        } else{
          db.run(`UPDATE users SET user_points = user_points + 100 WHERE user_id = ?`, [chatId], (err11) => {
            if(err11){
              console.error('Error updating user_points:', err11.message);
            } else{
              //
                bot.sendMessage(chatId, `Congratulations! Your CheckIn has been credited. Kindly check your balance to verify.`);
            }
          });
        }
      } );
    
    }
db.get( `SELECT * FROM users WHERE user_id = ?`, [chatId], (err12, row12)=>{
  if(err12){
    console.error('Error querying users table:', err12.message);
    bot.sendMessage(chatId, 'Sorry, there was an error. Try again Later');
    return;
  }else{
    if(row12 && row12.ton_balance >= 2){
      convertingMessage();
      setTimeout(()=>{
        almostDone();
        setTimeout(()=>{
          done();
        }, 3000);
      }, 3000);
    }else if(row12 && row12.ton_balance < 2){
      bot.sendMessage(chatId, `Sorry, you don't have enough TON to convert to CheckIn.`);
    } else{
      bot.sendMessage(chatId, 'Error Occured');
    }
  }
})
    
  } else if(callbackData=='confirmTrsct2') {
    function convertingMessage2(){
      bot.deleteMessage(chatId, messageId);
      bot.sendMessage(chatId, `Please wait while we are converting your CheckIn to TON.`);
    };
    function almostDone2(){
      bot.sendMessage(chatId, `Hold on, Almost Done!`);}
      function done2(){
        db.run(`UPDATE users SET user_points = user_points - 1000 WHERE user_id = ?`, [chatId], 
     (err)=>{
       if(err){
         console.error('Error updating user_points:', err.message);
       } else{
db.run(`UPDATE users SET ton_balance = ton_balance + 20 WHERE user_id = ?`, [chatId],(err14)=>{
  if(err14){
    console.error('Error updating ton_balance:', err14.message);
  } else{
    bot.sendMessage(chatId, `Congratulations! Your TON has been Credited. Kindly check your balance to verify.`);
  }
})
         
       }
     } )};
    db.get( `SELECT * FROM users WHERE user_id = ?`, [chatId], (err18, row18)=>{
      if(err18){
        console.error('Error querying users table:', err18.message);
        bot.sendMessage(chatId, 'Sorry, there was an error. Try again Later');
        return;
      }else{
        if(row18 && row18.user_points >= 1000){
          convertingMessage2();
          setTimeout(()=>{
            almostDone2();
            setTimeout(()=>{
              done2();
            }, 3000);
          }, 3000);
        }else if(row18 && row18.user_points < 1000){
          bot.sendMessage(chatId, `Sorry, you don't have enough CheckIn to convert to TON.`);
        } else{
          bot.sendMessage(chatId, 'Error Occured');
        }
      }
    });
    
  }else if(callbackData == 'confirmTrsct3'){
    bot.deleteMessage(chatId, messageId);
    bot.sendMessage(chatId, `Please Select TON Amount to withdraw`, {
    reply_markup: {
      inline_keyboard: [
        [{
          text: '10 TON',
          callback_data: 'withd10t'
        }, {
          text: '15 TON',
          callback_data: 'withd15t'
        },
        {
          text: '20 TON',
          callback_data: 'withd20t'
        }],
        [{
          text: '25 TON',
          callback_data: 'withd25t'
        }, {
          text: '30 TON',
          callback_data: 'withd30t'
        },
        {
          text: '35 TON',
          callback_data: 'withd35t'
        }],
        [{
          text: '40 TON',
          callback_data: 'withd40t'
        }, {
          text: '45 TON',
          callback_data: 'withd45t'
        },
        {
          text: '50 TON',
          callback_data: 'withd50t'
        }]
      ]
    }
    })
  }else if(callbackData == 'transactionCancel'){
      bot.deleteMessage(chatId, messageId);
      bot.sendMessage(chatId, `Transaction Cancelled.`, {parseMode: 'Markdown'});
    } /*else if(callbackData == 'withd10t'){
      bot.deleteMessage(chatId, messageId);
      bot.sendMessage(chatId, `WITHDRAWAL REQUEST SUBMITTED. 
      ADMIN WILL REVIEW YOUR REQUEST AND YOUR TOKEN WILL BE CREDITED IMMEDIATELY AFTER VERIFICATION.
      
      Please, It may take up to 48 hours for your TON to be credited.`, {parseMode: 'Markdown'});
      db.run( `UPDATE users SET ton_balance = ton_balance - 10 WHERE user_id = ?`, [chatId],(err)=>{
        if(err){
          console.error('Error updating ton_balance:', err.message);
        } else {
          bot.sendMessage(6217166646, `New Withdrawal Request:
          User ID: ${chatId}
          Amount: 10 TON
          User Name: ${row.user_name}
          User FirstName: ${row.user_first_name}
          User LastName: ${row.user_last_name}
          Wallet Address: ${row.ton_wallet}
      `)
        }
      })
    } */

  const handleWithdrawalRequest = (amount, callbackData) => {
    if (callbackData == `withd${amount}t`) {
        db.get(`SELECT ton_balance, user_name, user_firstname, user_lastname, ton_wallet FROM users WHERE user_id = ?`, [chatId], (err, row) => {
            if (err) {
                console.error('Error fetching ton_balance:', err.message);
                bot.sendMessage(chatId, 'An error occurred. Please try again later.');
            } else if (row.ton_balance < amount) {
                bot.sendMessage(chatId, 'Not Enough Balance');
            } else {
                bot.deleteMessage(chatId, messageId);
                bot.sendMessage(chatId, `WITHDRAWAL REQUEST SUBMITTED. 
                ADMIN WILL REVIEW YOUR REQUEST AND YOUR TOKEN WILL BE CREDITED IMMEDIATELY AFTER VERIFICATION.
                
                Please, It may take up to 48 hours for your TON to be credited.`, {parseMode: 'Markdown'});
                db.run(`UPDATE users SET ton_balance = ton_balance - ? WHERE user_id = ?`, [amount, chatId], (err) => {
                    if (err) {
                        console.error('Error updating ton_balance:', err.message);
                    } else {
                        bot.sendMessage(6217166646, `New Withdrawal Request:
                        User ID: ${chatId}
                        Amount: ${amount} TON
                        User Name: ${row.user_name}
                        User FirstName: ${row.user_firstname}
                        User LastName: ${row.user_lastname}
                        Wallet Address: ${row.ton_wallet}
                    `);
                    }
                });
            }
        });
    }
};

// Example of handling callback data:
if (callbackData.startsWith('withd')) {
    if (callbackData === 'withd10t') {
        handleWithdrawalRequest(10, callbackData);
    } else if (callbackData === 'withd15t') {
        handleWithdrawalRequest(15, callbackData);
    } else if (callbackData === 'withd20t') {
        handleWithdrawalRequest(20, callbackData);
    } else if (callbackData === 'withd25t') {
        handleWithdrawalRequest(25, callbackData);
    } else if (callbackData === 'withd30t') {
        handleWithdrawalRequest(30, callbackData);
    } else if (callbackData === 'withd35t') {
        handleWithdrawalRequest(35, callbackData);
    } else if (callbackData === 'withd40t') {
        handleWithdrawalRequest(40, callbackData);
    } else if (callbackData === 'withd45t') {
        handleWithdrawalRequest(45, callbackData);
    } else if (callbackData === 'withd50t') {
        handleWithdrawalRequest(50, callbackData);
    }
}



    
  //if(callBackData == 'tokensent'){
    //bot.sendMessage
 // }
});
//log bot polling error 
bot.on('polling_error', (error) =>{
  console.error('Polling error:', error.message);
})
