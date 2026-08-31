const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

async function commit() {
  const form = new FormData();
  form.append('file', fs.createReadStream('/sdcard/Download/LS_Studio_Bot_247.zip'));

  try {
    const res = await axios.put('https://api.discloud.app/v2/app/1787827063185/commit', form, {
      headers: {
        'api-token': process.env.DISCLOUD_TOKEN || (fs.existsSync('./token.local.js') ? require('./token.local.js').DISCLOUD_TOKEN : 'YOUR_DISCLOUD_TOKEN'),
        ...form.getHeaders()
      }
    });
    console.log('✅ Commit Result:', res.data);
  } catch (err) {
    console.error('❌ Commit Error:', err.response ? err.response.data : err.message);
  }
}

commit();
