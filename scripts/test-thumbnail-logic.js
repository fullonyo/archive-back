// Test script para validar a lógica de extração de ID do Google Drive

function extractGoogleDriveId(url) {
  if (!url || typeof url !== 'string') return null;
  
  // Pattern 1: https://drive.google.com/file/d/FILE_ID/view
  const pattern1 = /\/file\/d\/([a-zA-Z0-9_-]+)/;
  const match1 = url.match(pattern1);
  if (match1) return match1[1];
  
  // Pattern 2: https://drive.google.com/uc?id=FILE_ID
  // Pattern 3: https://drive.google.com/uc?export=download&id=FILE_ID
  // Pattern 4: https://drive.google.com/uc?export=view&id=FILE_ID
  const pattern2 = /[?&]id=([a-zA-Z0-9_-]+)/;
  const match2 = url.match(pattern2);
  if (match2) return match2[1];
  
  // Pattern 5: https://drive.google.com/thumbnail?id=FILE_ID&sz=w400
  const pattern3 = /thumbnail\?id=([a-zA-Z0-9_-]+)/;
  const match3 = url.match(pattern3);
  if (match3) return match3[1];
  
  // Pattern 6: https://drive.google.com/open?id=FILE_ID
  const pattern4 = /open\?id=([a-zA-Z0-9_-]+)/;
  const match4 = url.match(pattern4);
  if (match4) return match4[1];
  
  // Pattern 7: https://lh3.googleusercontent.com/d/FILE_ID
  const pattern5 = /googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/;
  const match5 = url.match(pattern5);
  if (match5) return match5[1];
  
  // If it looks like a direct ID (no URL format)
  if (/^[a-zA-Z0-9_-]{25,}$/.test(url)) {
    return url;
  }
  
  return null;
}

// Test cases
const testUrls = [
  // Real Google Drive URLs
  'https://drive.google.com/file/d/1qpE7ewX_Lgko7MEf1KvZW-PluwGO9WPv/view',
  'https://drive.google.com/uc?id=1qpE7ewX_Lgko7MEf1KvZW-PluwGO9WPv',
  'https://drive.google.com/uc?export=download&id=1qpE7ewX_Lgko7MEf1KvZW-PluwGO9WPv',
  'https://drive.google.com/uc?export=view&id=1qpE7ewX_Lgko7MEf1KvZW-PluwGO9WPv',
  'https://drive.google.com/thumbnail?id=1qpE7ewX_Lgko7MEf1KvZW-PluwGO9WPv&sz=w400',
  'https://drive.google.com/open?id=1qpE7ewX_Lgko7MEf1KvZW-PluwGO9WPv',
  'https://lh3.googleusercontent.com/d/1qpE7ewX_Lgko7MEf1KvZW-PluwGO9WPv',
  'https://lh3.googleusercontent.com/d/1qpE7ewX_Lgko7MEf1KvZW-PluwGO9WPv=w1920-h1080',
  
  // Direct ID
  '1qpE7ewX_Lgko7MEf1KvZW-PluwGO9WPv',
  
  // Invalid cases
  'https://drive.google.com/uc?id=test_thumb_1',
  'test_drive_id_1',
  null,
  undefined,
  '',
];

console.log('=== Google Drive ID Extraction Tests ===\n');

testUrls.forEach((url, index) => {
  const id = extractGoogleDriveId(url);
  const status = id ? '✅' : '❌';
  
  console.log(`Test ${index + 1}: ${status}`);
  console.log(`  Input:  ${url}`);
  console.log(`  Output: ${id || 'null'}`);
  
  if (id) {
    const thumbnailUrl = `https://drive.google.com/thumbnail?id=${id}&sz=w400`;
    console.log(`  Thumbnail: ${thumbnailUrl}`);
  }
  
  console.log('');
});

console.log('\n=== Summary ===');
const successful = testUrls.filter(url => extractGoogleDriveId(url)).length;
console.log(`✅ Successful extractions: ${successful}/${testUrls.length}`);
