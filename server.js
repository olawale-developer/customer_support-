const dotenv = require('dotenv');
dotenv.config();
const express = require('express')
const TelegramBot = require('node-telegram-bot-api');
const telegramToken = process.env.TelegramToken
const bot = new TelegramBot(telegramToken, { polling: true });
const mysql = require('mysql2');
const cors = require('cors');
let menuChoice = {}
let sessions = {}


const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
});
  

const app = express()
  
app.use(cors()); 

app.use(express.json({ limit: '100mb' }));


 bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const pattern = /^(\w+):/;
    const match = pattern.exec(data);
  const transactionId = match[1];
    sessions[chatId] = {}
    switch (transactionId) {
       case 'Transaction_id':
        verify(chatId, data, bot, menuChoice, db, sessions)
        break;
      case 'Gift_id':
        giftVerify(chatId,data, bot, menuChoice,db,sessions)
        break;
       case 'Report_id':
        reportlyVerify(chatId,data, bot, menuChoice,db,sessions)
        break;
      case 'complain_id':
        complainVerify(chatId,data, bot, menuChoice,db,sessions)
        break;
    }

  })

//   bot.on('callback_query', (query) => {
//     const chatId = query.message.chat.id;
//     const data = query.data;
  
//     // Handle different menu options
//       switch (data) {
//           case 'Attender':
//               const menuOption = [
//                   '1. Transfer/ Make deposit',
//                   '2. Withdraw cash with transfer',
//                   '0. Go back',
//               ];
//               bot.sendMessage(chatId, 'MENU: Enter option number:\n' + menuOption.join('\n'));
//               menuChoice[chatId] = 'nairaMenu'
//               sessions[chatId]['exit'] = '2settleHQ_agent'
//               break;
//       }
//   });



function supportChatid(message, menuOptions) {
     db.query('SELECT * FROM 2Settle_support_table',  (err, result) => {
    if (err) {
      console.error('Error querying the database:', err);
      return;
    }
    if (result.length > 0) {
             const chat_id =  result.map((row) =>  `${row.chat_id}`)
             const uniqueChat_id = [...new Set(chat_id)];
            for (let i = 0; i < uniqueChat_id.length; i++){

           const menuMarkup = {
            reply_markup: {
                inline_keyboard: menuOptions,
             },
           };
        
        
          //  bot.sendMessage(chatId, message, menuMarkup);
        bot.sendMessage(uniqueChat_id[i], message, menuMarkup)
         }
    }
})
}

// function attender(chatId, transactionId) {
//     db.query('SELECT * FROM 2settle_transaction_table WHERE transac_id = ?', transactionId, (err, result) => {
//         if (err) {
//             console.error('Error querying the database:', err);
//             return;
//         }
//         if (result.length > 0) {
//             sessions[chatId]['confirm_by'] = result.map((row) => row.confirm_by)
 
//             if (sessions[chatId]['confirm_by'] || sessions[chatId]['confirm_by'] !== 'null') {
//         const messageDetails = [
//           `Name: ${session['stringName']}`,
//           `Bank name: ${bank_name}`,
//           `Account number: ${acct_number}`,
//           `Receiver Amount: ${amount_sent}`,
//           `Transaction_id: ${transac_id}`
//         ];
//             }
//          }

//     })


// }




// this function verify transactions from 2settle_HQ
function verify(chatId,choice, bot, menuChoice,db,sessions){
 
  const pattern = /^Transaction_id:\s*(\d+)\s*(Successful|Unsuccessful)$/i;
    
  if (pattern.test(choice)) {
         
                const [, transactionId, successMessage] = choice.match(pattern);
            // query to get support_agent name
                db.query('SELECT * FROM 2Settle_support_table WHERE chat_id = ?', chatId, (err, result) => {
                  if (err) {
                    console.error('Error querying the database:', err);
                    return;
                  }
                
                  sessions[chatId]['name'] = result.map((row) => row.support_name.toString())
                  sessions[chatId]['phone_number'] = result.map((row) => row.support_phoneNumber.toString())
                  // query to check if the transaction exists in the trancastion_table
                  db.query('SELECT * FROM 2settle_transaction_table WHERE transac_id = ?', transactionId , (err, result) => {
                    if (err) {
                      console.error('Error querying the database:', err);
                      return;
                    }
                    if (result.length > 0) {
                       const raw = result.map((row) => row.status)
                      sessions[chatId]['status'] = raw.toString()
                      sessions[chatId]['confirm_by'] = result.map((row) => row.confirm_by)

                      // if transaction is processing, update the status, else send a message that transaction is already updated
                      if (sessions[chatId]['status'] === 'Processing') {

                       const sql = `UPDATE 2settle_transaction_table
                       SET status = ?, confirm_by = ?, confimer_phoneNumber = ?
                         WHERE transac_id = ?`;

                        db.query(sql, [successMessage, sessions[chatId]['name'], sessions[chatId]['phone_number'], transactionId], (err, results) => {
                        if (err) {
                        console.error('Error updating data:', err);
                           return;
                           }

                       if (results.affectedRows > 0) {
                        const message = `Transaction_id: ${transactionId} updated as ${successMessage} by ${sessions[chatId]['name']}`; 
                        bot.sendMessage(chatId, message);
                        menuChoice[chatId] = ''
                        }
                          })
                        }else {
                        const message = `Transaction_id: ${transactionId} already updated by ${sessions[chatId]['confirm_by']}`;
                        bot.sendMessage(chatId, message);
                        return;
                    }

                    }else {
                        const message = 'Transaction ID is not valid. Try again';
                        bot.sendMessage(chatId, message);
                        return;
                    }
     
                  })
              })
}else {
  const message = 'This transaction confirmation is bad request, please contact tech team';
  bot.sendMessage(chatId, message);
}
}

app.post("/message", (req, res) => {
    // console.log(req.body)
   const message = req.body.message;
   const menuOptions = req.body.menuOptions;
    
   supportChatid(message, menuOptions)
}) 
  
app.listen(5000, () => console.log(`Server is ready in on port ${5000}`))