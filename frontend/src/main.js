import { fetchAlbumInfo } from './jmcomic.js';

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('jm-id-input');
  const searchBtn = document.getElementById('search-btn');
  const visualContent = document.getElementById('visual-content');
  const resultContainer = document.getElementById('result-container');
  const loadingIndicator = document.getElementById('loading-indicator');
  const errorMsg = document.getElementById('error-msg');
  const comicInfo = document.getElementById('comic-info');
  
  const comicTitle = document.getElementById('comic-title');
  const comicAuthor = document.getElementById('comic-author');
  const comicTags = document.getElementById('comic-tags');
  const jmLink = document.getElementById('jm-link');

  const updateVisual = (album) => {
    visualContent.innerHTML = '';
    visualContent.classList.remove('placeholder');
    
    // As JS doesn't get cover from local easily, we rely on JMComic image domains if available
    // But JMComic image URL format is usually like: https://cdn-msp.18comic.org/media/albums/{id}_3x4.jpg
    const imgUrl = `https://cdn-msp.18comic.org/media/albums/${album.id}_3x4.jpg`;
    
    const img = document.createElement('img');
    img.src = imgUrl;
    img.alt = album.name;
    // Fallback if image fails
    img.onerror = () => {
      visualContent.innerHTML = `<span>暂无封面</span>`;
      visualContent.classList.add('placeholder');
    };
    visualContent.appendChild(img);
  };

  const handleSearch = async () => {
    const jmId = input.value.trim().replace(/\D/g, ''); // Extract numbers
    
    if (!jmId) {
      showError('请输入有效的数字车牌号');
      return;
    }

    // UI State: Loading
    resultContainer.classList.remove('hidden');
    loadingIndicator.classList.remove('hidden');
    errorMsg.classList.add('hidden');
    comicInfo.classList.add('hidden');

    try {
      const album = await fetchAlbumInfo(jmId);
      
      // UI State: Success
      loadingIndicator.classList.add('hidden');
      comicInfo.classList.remove('hidden');
      
      comicTitle.textContent = album.name || `JMComic - ${jmId}`;
      comicAuthor.textContent = `作者: ${(album.author || []).join(', ') || '未知'}`;
      
      // Tags
      comicTags.innerHTML = '';
      (album.tags || []).forEach(tag => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.textContent = tag;
        comicTags.appendChild(span);
      });

      jmLink.href = `https://18comic.vip/album/${jmId}`;
      
      updateVisual(album);

    } catch (err) {
      // UI State: Error
      loadingIndicator.classList.add('hidden');
      showError(err.message);
    }
  };

  const showError = (msg) => {
    resultContainer.classList.remove('hidden');
    errorMsg.classList.remove('hidden');
    errorMsg.textContent = msg;
  };

  searchBtn.addEventListener('click', handleSearch);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  });
});
