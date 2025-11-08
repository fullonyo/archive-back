const axios = require('axios');

async function testApiResponse() {
  try {
    const response = await axios.get('http://localhost:3001/api/assets', {
      params: {
        page: 1,
        limit: 3,
        sortBy: 'latest'
      }
    });

    console.log('=== API Response Check ===\n');
    
    if (response.data.assets && response.data.assets.length > 0) {
      response.data.assets.forEach((asset, index) => {
        console.log(`Asset ${index + 1}: ${asset.title}`);
        console.log(`  ID: ${asset.id}`);
        console.log(`  thumbnailUrl: ${asset.thumbnailUrl}`);
        console.log(`  googleDriveId: ${asset.googleDriveId}`);
        console.log(`  googleDriveUrl: ${asset.googleDriveUrl}`);
        console.log('');
      });
    } else {
      console.log('No assets returned');
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testApiResponse();
