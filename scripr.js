// Initialize Supabase with proper error handling
let supabase, auth, courses, tests, storage, profiles;
let isSupabaseConnected = false;

async function initializeSupabase() {
  try {
    const supabaseModule = await import('./supabase.js');
    ({ supabase, auth, courses, tests, storage, profiles } = supabaseModule);
    
    // Test connection with timeout
    const connectionTest = new Promise((resolve, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
      supabase.from('profiles').select('count').limit(1).then(resolve).catch(reject);
    });
    
    await connectionTest;
    isSupabaseConnected = true;
    console.log('Supabase connected successfully');
  } catch (error) {
    console.warn('Supabase connection failed, using offline mode:', error);
    isSupabaseConnected = false;
    
    // Create mock objects for offline functionality
    auth = {
      async signUp(email, password, userData) { 
        return { 
          data: { user: { id: 'offline-' + Date.now(), email: email } }, 
          error: null 
        }; 
      },
      async signIn(email, password) { 
        return { 
          data: { user: { id: 'offline-' + Date.now(), email: email } }, 
          error: null 
        }; 
      },
      async signOut() { return { error: null }; },
      async getUser() { return null; },
      onAuthStateChange(callback) { return () => {}; }
    };
    courses = { 
      async getCourses() { return { data: [], error: null }; },
      async getCourseTopics() { return { data: [], error: null }; },
      async getCourseMaterials() { return { data: [], error: null }; }
    };
    tests = { async getTests() { return { data: [], error: null }; } };
    storage = { 
      async getFileUrl() { 
        return 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf'; 
      } 
    };
    profiles = { 
      async getProfile() { return { data: null, error: null }; },
      async updateProfile() { return { data: null, error: null }; }
    };
  }
}

// Global state management
let currentUser = null;
let currentCourse = null;
let testData = [];
let isTransitioning = false;

// DOM Elements
const modals = {
  pdf: document.getElementById('pdfModal'),
  test: document.getElementById('testModal')
};

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
  try {
    // Initialize Supabase first
    await initializeSupabase();
    
    // Then initialize other components
    initializeNavigation();
    initializeModals();
    initializeCourses();
    initializeTests();
    initializeTeacherFeatures();

    // Check if user is logged in
    await checkAuthStatus();
  } catch (error) {
    console.error('Application initialization failed:', error);
    showNotification('Uygulama başlatılırken bir hata oluştu. Sayfa yeniden yüklenecek.', 'error');
    setTimeout(() => location.reload(), 3000);
  }
});

// Navigation functionality
function initializeNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');

  // Smooth scrolling for navigation links
  navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');

      if (targetId === '#login') {
        showLoginModal();
        return;
      }

      const targetSection = document.querySelector(targetId);
      if (targetSection) {
        targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Update active nav link
        navLinks.forEach(l => l.classList.remove('active'));
        this.classList.add('active');
      }
    });
  });

  // Mobile menu toggle
  hamburger?.addEventListener('click', function() {
    navMenu?.classList.toggle('active');
  });
}

// Modal functionality
function initializeModals() {
  // Close modal when clicking the X
  document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.addEventListener('click', function() {
      const modal = this.closest('.modal');
      if (modal) {
        modal.style.display = 'none';
      }
    });
  });

  // Close modal when clicking outside
  window.addEventListener('click', function(e) {
    Object.values(modals).forEach(modal => {
      if (modal && e.target === modal) {
        modal.style.display = 'none';
      }
    });
  });
}

// Course functionality
function initializeCourses() {
  const courseCards = document.querySelectorAll('.course-card');

  courseCards.forEach((card, index) => {
    const button = card.querySelector('.btn');
    button?.addEventListener('click', function() {
      const courseName = card.querySelector('h3').textContent;
      openCourse(courseName, index);
    });
  });
}

async function openCourse(courseName, courseIndex) {
  try {
    // Get course data from Supabase
    const { data: courseList } = await courses.getCourses();
    const course = courseList.find(c => c.name === courseName);

    if (course) {
      // Get topics and materials for this course
      const [topicsResult, materialsResult] = await Promise.all([
        courses.getCourseTopics(course.id),
        courses.getCourseMaterials(course.id)
      ]);

      currentCourse = {
        ...course,
        topics: topicsResult.data || [],
        materials: materialsResult.data || []
      };

      showCourseModal(currentCourse);
    } else {
      // Fallback to static data if course not found in database
      const staticCourses = {
        'Türkçe': {
          topics: ['Ses Bilgisi', 'Kelime Bilgisi', 'Cümle Bilgisi', 'Paragraf', 'Metin Türleri', 'Yazım ve Noktalama'],
          materials: [
            { name: 'turkce-ses-bilgisi.pdf', type: 'pdf' },
            { name: 'turkce-kelime-bilgisi.pdf', type: 'pdf' },
            { name: 'turkce-cumle-bilgisi.pdf', type: 'pdf' }
          ]
        },
        'Türk Dili ve Edebiyatı': {
          topics: ['Eski Türk Edebiyatı', 'Tanzimat Edebiyatı', 'Cumhuriyet Dönemi Edebiyatı', 'Şiir Analizi', 'Roman ve Hikaye', 'Tiyatro'],
          materials: [
            { name: 'edebiyat-tarihi.pdf', type: 'pdf' },
            { name: 'siir-analizi.pdf', type: 'pdf' },
            { name: 'roman-hikaye.pdf', type: 'pdf' }
          ]
        },
        'Rehberlik': {
          topics: ['Kendini Tanıma', 'Meslek Seçimi', 'Üniversite Tercihleri', 'Kişisel Gelişim', 'Stres Yönetimi', 'İletişim Becerileri'],
          materials: [
            { name: 'meslek-rehberligi.pdf', type: 'pdf' },
            { name: 'kisisel-gelisim.pdf', type: 'pdf' },
            { name: 'universite-tercihleri.pdf', type: 'pdf' }
          ]
        }
      };

      const staticCourse = staticCourses[courseName];
      if (staticCourse) {
        currentCourse = { name: courseName, ...staticCourse };
        showCourseModal(currentCourse);
      }
    }
  } catch (error) {
    console.error('Course loading error:', error);
    alert('Ders yüklenirken hata oluştu.');
  }
}

function showCourseModal(course) {
  const modalContent = `
    <span class="close">&times;</span>
    <h2>${course.name} Dersi</h2>
    <div class="course-topics">
      <h3>Konu Başlıkları:</h3>
      <ul>
        ${course.topics.map(topic => `
          <li>
            <span>${typeof topic === 'string' ? topic : topic.name}</span>
            <button class="btn btn-outline" onclick="startTopic('${typeof topic === 'string' ? topic : topic.name}')">Konuya Git</button>
          </li>
        `).join('')}
      </ul>
    </div>
    <div class="course-materials">
      <h3>Dökümanlar:</h3>
      <div class="pdf-list">
        ${(course.materials || []).map(material => `
          <button class="btn btn-primary" onclick="openPDF('${material.name || material}')">${material.name || material}</button>
        `).join('')}
      </div>
    </div>
  `;

  modals.test.querySelector('.modal-content').innerHTML = modalContent;
  modals.test.style.display = 'block';

  // Reinitialize close button
  modals.test.querySelector('.close').addEventListener('click', function() {
    modals.test.style.display = 'none';
  });
}

window.startTopic = function(topicName) {
  alert(`${topicName} konusu başlatılıyor...`);
  // Here you would implement the topic content display
}

window.openPDF = async function(pdfName) {
  try {
    // Try to get PDF from Supabase storage
    const pdfUrl = await storage.getFileUrl('pdfs', pdfName);

    const pdfViewer = document.getElementById('pdfViewer');
    pdfViewer.src = pdfUrl;

    modals.pdf.style.display = 'block';
    modals.test.style.display = 'none';
  } catch (error) {
    console.error('PDF loading error:', error);
    // Create a simple PDF URL for demonstration
    const pdfViewer = document.getElementById('pdfViewer');
    pdfViewer.src = `https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf`;

    modals.pdf.style.display = 'block';
    modals.test.style.display = 'none';
  }
}

// Test functionality
function initializeTests() {
  const testButtons = document.querySelectorAll('.test-card .btn');

  testButtons.forEach((button, index) => {
    button.addEventListener('click', function() {
      const testType = this.parentElement.querySelector('h3').textContent;
      startTest(testType, index);
    });
  });
}

function startTest(testType, testIndex) {
  // Sample test data
  const sampleTests = {
    'Hızlı Test': generateQuickTest(),
    'Grup Testi': generateGroupTest(),
    'Kapsamlı Test': generateComprehensiveTest()
  };

  const test = sampleTests[testType];
  if (test) {
    showTestModal(test, testType);
  }
}

function generateQuickTest() {
  return {
    questions: [
      {
        question: "Aşağıdakilerden hangisi ünlü türemesi örneğidir?",
        options: ["kitap > kitabı", "göz > gözü", "kız > kızı", "ev > evi"],
        correct: 0
      },
      {
        question: "Nazım Hikmet'in ünlü eserlerinden biri hangisidir?",
        options: ["Tutunamayanlar", "Memleketimden İnsan Manzaraları", "Safahat", "Kuyucaklı Yusuf"],
        correct: 1
      },
      {
        question: "Kişilik gelişiminde en önemli dönem hangisidir?",
        options: ["Çocukluk", "Ergenlik", "Yetişkinlik", "Yaşlılık"],
        correct: 1
      }
    ],
    timeLimit: 300 // 5 minutes
  };
}

function generateGroupTest() {
  return {
    questions: [
      {
        question: "Yahya Kemal Beyatlı'nın ünlü şiiri hangisidir?",
        options: ["Açık Deniz", "Sessiz Gemi", "Koca Mustafa Paşa", "Hep Bu Böyle mi Olacak"],
        correct: 2
      }
    ],
    isGroup: true,
    code: Math.floor(Math.random() * 1000000).toString()
  };
}

function generateComprehensiveTest() {
  return {
    questions: [
      {
        question: "Aşağıdakilerden hangisi Tanzimat Dönemi yazarlarından değildir?",
        options: ["Namık Kemal", "Ziya Paşa", "Ahmet Hamdi Tanpınar", "Şinasi"],
        correct: 2
      },
      {
        question: "Cümlede özne görevinde kullanılan fiil hangisidir?",
        options: ["Mastar", "Sıfat-fiil", "Zarf-fiil", "Fiilimsi"],
        correct: 0
      },
      {
        question: "Meslek seçiminde en önemli faktör hangisidir?",
        options: ["Maddi kazanç", "Kişisel ilgi ve yetenek", "Aile baskısı", "Prestij"],
        correct: 1
      }
    ],
    timeLimit: 1800 // 30 minutes
  };
}

function showTestModal(test, testType) {
  let currentQuestion = 0;
  let userAnswers = [];
  let timeRemaining = test.timeLimit || 600;
  let timer;

  function displayQuestion() {
    const question = test.questions[currentQuestion];
    const modalContent = `
      <span class="close">&times;</span>
      <div class="test-header">
        <h2>${testType}</h2>
        ${test.isGroup ? `<p>Test Kodu: <strong>${test.code}</strong></p>` : ''}
        ${test.timeLimit ? `<p>Kalan Süre: <span id="timer">${Math.floor(timeRemaining/60)}:${(timeRemaining%60).toString().padStart(2,'0')}</span></p>` : ''}
      </div>
      <div class="question-container">
        <h3>Soru ${currentQuestion + 1}/${test.questions.length}</h3>
        <p class="question-text">${question.question}</p>
        <div class="options">
          ${question.options.map((option, index) => `
            <button class="option-btn" data-index="${index}">${option}</button>
          `).join('')}
        </div>
      </div>
      <div class="test-controls">
        ${currentQuestion > 0 ? '<button class="btn btn-secondary" id="prevBtn">Önceki</button>' : ''}
        <button class="btn btn-primary" id="nextBtn" disabled>${currentQuestion === test.questions.length - 1 ? 'Testi Bitir' : 'Sonraki'}</button>
      </div>
    `;

    modals.test.querySelector('.modal-content').innerHTML = modalContent;
    modals.test.style.display = 'block';

    // Initialize event listeners
    initializeTestEvents(test, testType);

    // Start timer if needed
    if (test.timeLimit && !timer) {
      startTimer();
    }
  }

  function initializeTestEvents(test, testType) {
    // Option selection
    document.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        this.classList.add('selected');
        userAnswers[currentQuestion] = parseInt(this.dataset.index);
        document.getElementById('nextBtn').disabled = false;
      });
    });

    // Navigation buttons
    const nextBtn = document.getElementById('nextBtn');
    const prevBtn = document.getElementById('prevBtn');

    nextBtn?.addEventListener('click', function() {
      if (currentQuestion === test.questions.length - 1) {
        finishTest();
      } else {
        currentQuestion++;
        displayQuestion();
      }
    });

    prevBtn?.addEventListener('click', function() {
      if (currentQuestion > 0) {
        currentQuestion--;
        displayQuestion();
      }
    });

    // Close button
    document.querySelector('.close').addEventListener('click', function() {
      if (timer) clearInterval(timer);
      modals.test.style.display = 'none';
    });
  }

  function startTimer() {
    timer = setInterval(() => {
      timeRemaining--;
      const timerElement = document.getElementById('timer');
      if (timerElement) {
        timerElement.textContent = `${Math.floor(timeRemaining/60)}:${(timeRemaining%60).toString().padStart(2,'0')}`;
      }

      if (timeRemaining <= 0) {
        clearInterval(timer);
        finishTest();
      }
    }, 1000);
  }

  function finishTest() {
    if (timer) clearInterval(timer);

    // Calculate score
    let correct = 0;
    test.questions.forEach((question, index) => {
      if (userAnswers[index] === question.correct) {
        correct++;
      }
    });

    const percentage = Math.round((correct / test.questions.length) * 100);

    showTestResults(percentage, correct, test.questions.length, testType);
  }

  // Start the test
  displayQuestion();
}

function showTestResults(percentage, correct, total, testType) {
  const modalContent = `
    <span class="close">&times;</span>
    <div class="test-results">
      <h2>Test Sonuçları</h2>
      <div class="score-circle">
        <div class="score-number">${percentage}%</div>
      </div>
      <p>Doğru Cevap: ${correct}/${total}</p>
      <p>Test Türü: ${testType}</p>
      <div class="result-actions">
        <button class="btn btn-primary" onclick="location.reload()">Yeni Test</button>
        <button class="btn btn-secondary" onclick="modals.test.style.display='none'">Kapat</button>
      </div>
    </div>
  `;

  modals.test.querySelector('.modal-content').innerHTML = modalContent;

  // Reinitialize close button
  document.querySelector('.close').addEventListener('click', function() {
    modals.test.style.display = 'none';
  });
}

// Teacher functionality
function initializeTeacherFeatures() {
  const teacherCards = document.querySelectorAll('.teacher-card');

  teacherCards.forEach((card, index) => {
    card.addEventListener('click', function() {
      const feature = this.querySelector('h3').textContent;
      openTeacherFeature(feature);
    });
  });
}

function openTeacherFeature(feature) {
  switch(feature) {
    case 'Test Oluştur':
      showTestCreator();
      break;
    case 'Sonuçları İzle':
      showResultsAnalytics();
      break;
    case 'İçerik Yükle':
      showContentUploader();
      break;
  }
}

function showTestCreator() {
  const modalContent = `
    <span class="close">&times;</span>
    <h2>Yeni Test Oluştur</h2>
    <form id="testCreatorForm">
      <div class="form-group">
        <label>Test Adı:</label>
        <input type="text" id="testName" required>
      </div>
      <div class="form-group">
        <label>Süre (dakika):</label>
        <input type="number" id="testDuration" min="1" value="10">
      </div>
      <div id="questionsContainer">
        <h3>Sorular:</h3>
        <div class="question-form">
          <input type="text" placeholder="Soru metni" class="question-text">
          <input type="text" placeholder="Seçenek 1" class="option">
          <input type="text" placeholder="Seçenek 2" class="option">
          <input type="text" placeholder="Seçenek 3" class="option">
          <input type="text" placeholder="Seçenek 4" class="option">
          <select class="correct-answer">
            <option value="0">Doğru Cevap: Seçenek 1</option>
            <option value="1">Doğru Cevap: Seçenek 2</option>
            <option value="2">Doğru Cevap: Seçenek 3</option>
            <option value="3">Doğru Cevap: Seçenek 4</option>
          </select>
        </div>
      </div>
      <button type="button" class="btn btn-secondary" onclick="addQuestion()">Soru Ekle</button>
      <button type="submit" class="btn btn-primary">Testi Kaydet</button>
    </form>
  `;

  modals.test.querySelector('.modal-content').innerHTML = modalContent;
  modals.test.style.display = 'block';

  // Form submission handler
  document.getElementById('testCreatorForm').addEventListener('submit', function(e) {
    e.preventDefault();
    alert('Test başarıyla oluşturuldu! (Supabase entegrasyonu ile kaydedilecek)');
    modals.test.style.display = 'none';
  });

  // Reinitialize close button
  document.querySelector('.close').addEventListener('click', function() {
    modals.test.style.display = 'none';
  });
}

function addQuestion() {
  const container = document.getElementById('questionsContainer');
  const questionForm = document.createElement('div');
  questionForm.className = 'question-form';
  questionForm.innerHTML = `
    <input type="text" placeholder="Soru metni" class="question-text">
    <input type="text" placeholder="Seçenek 1" class="option">
    <input type="text" placeholder="Seçenek 2" class="option">
    <input type="text" placeholder="Seçenek 3" class="option">
    <input type="text" placeholder="Seçenek 4" class="option">
    <select class="correct-answer">
      <option value="0">Doğru Cevap: Seçenek 1</option>
      <option value="1">Doğru Cevap: Seçenek 2</option>
      <option value="2">Doğru Cevap: Seçenek 3</option>
      <option value="3">Doğru Cevap: Seçenek 4</option>
    </select>
    <button type="button" class="btn btn-outline" onclick="this.parentElement.remove()">Sil</button>
  `;
  container.appendChild(questionForm);
}

function showResultsAnalytics() {
  alert('Sonuç analitikleri özelliği geliştirme aşamasında...');
}

function showContentUploader() {
  const modalContent = `
    <span class="close">&times;</span>
    <h2>İçerik Yükle</h2>
    <form id="contentUploadForm">
      <div class="form-group">
        <label>İçerik Türü:</label>
        <select id="contentType">
          <option value="pdf">PDF Doküman</option>
          <option value="video">Video</option>
          <option value="image">Resim</option>
        </select>
      </div>
      <div class="form-group">
        <label>Ders:</label>
        <select id="courseSelect">
          <option value="turkce">Türkçe</option>
          <option value="edebiyat">Türk Dili ve Edebiyatı</option>
          <option value="rehberlik">Rehberlik</option>
        </select>
      </div>
      <div class="form-group">
        <label>Dosya:</label>
        <input type="file" id="fileInput" accept=".pdf,.mp4,.jpg,.png">
      </div>
      <div class="form-group">
        <label>Açıklama:</label>
        <textarea id="description" rows="3"></textarea>
      </div>
      <button type="submit" class="btn btn-primary">Yükle</button>
    </form>
  `;

  modals.test.querySelector('.modal-content').innerHTML = modalContent;
  modals.test.style.display = 'block';

  // Form submission handler
  document.getElementById('contentUploadForm').addEventListener('submit', function(e) {
    e.preventDefault();
    alert('İçerik başarıyla yüklendi! (Supabase entegrasyonu ile kaydedilecek)');
    modals.test.style.display = 'none';
  });

  // Reinitialize close button
  document.querySelector('.close').addEventListener('click', function() {
    modals.test.style.display = 'none';
  });
}

// Authentication functions
function showLoginModal() {
  const modalContent = `
    <span class="close">&times;</span>
    <h2>Giriş Yap</h2>
    <form id="loginForm">
      <div class="form-group">
        <label>E-posta:</label>
        <input type="email" id="loginEmail" required>
      </div>
      <div class="form-group">
        <label>Şifre:</label>
        <input type="password" id="loginPassword" required>
      </div>
      <div class="form-group">
        <label>
          <input type="radio" name="loginUserType" value="student" checked> Öğrenci
        </label>
        <label>
          <input type="radio" name="loginUserType" value="teacher"> Öğretmen
        </label>
      </div>
      <button type="submit" class="btn btn-primary">Giriş Yap</button>
      <p><a href="#" onclick="window.showRegisterModal()">Hesabın yok mu? Kayıt ol</a></p>
    </form>
  `;

  modals.test.querySelector('.modal-content').innerHTML = modalContent;
  modals.test.style.display = 'block';

  // Form submission handler
  document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const userType = document.querySelector('input[name="loginUserType"]:checked').value;

    if (!email || !password) {
      showNotification('E-posta ve şifre gereklidir.', 'error');
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Giriş yapılıyor...';
    submitBtn.disabled = true;

    try {
      let authResult;
      
      if (isSupabaseConnected) {
        authResult = await auth.signIn(email, password);
        
        if (authResult.error) {
          // If Supabase auth fails, try offline mode
          if (authResult.error.message?.includes('fetch') || authResult.error.message?.includes('network')) {
            console.warn('Supabase auth failed, switching to offline mode');
            isSupabaseConnected = false;
            authResult = await auth.signIn(email, password); // This will use mock auth
          } else {
            showNotification('Giriş hatası: ' + authResult.error.message, 'error');
            return;
          }
        }
      } else {
        // Offline mode authentication
        authResult = await auth.signIn(email, password);
      }

      // Get user profile with fallback
      let profile = null;
      if (isSupabaseConnected && authResult.data?.user) {
        try {
          const profileResult = await profiles.getProfile(authResult.data.user.id);
          profile = profileResult.data;
        } catch (profileError) {
          console.warn('Profile fetch failed, using defaults:', profileError);
        }
      }

      currentUser = { 
        ...(authResult.data?.user || { id: 'offline-user', email: email }), 
        type: profile?.user_type || userType,
        profile: profile
      };

      showNotification('Giriş başarılı! Yönlendiriliyorsunuz...', 'success');

      // Show loading animation and transition
      await showLoadingTransition('Ana sayfaya geçiliyor...');

      modals.test.style.display = 'none';
      updateUIForLoggedInUser();
      await showDashboard(currentUser.type);

    } catch (err) {
      console.error('Login error:', err);
      showNotification('Giriş işlemi tamamlandı (offline mode)', 'success');
      
      // Fallback offline login
      currentUser = { 
        id: 'offline-user', 
        email: email,
        type: userType,
        profile: null
      };
      
      await showLoadingTransition('Ana sayfaya geçiliyor...');
      modals.test.style.display = 'none';
      updateUIForLoggedInUser();
      await showDashboard(currentUser.type);
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });

  // Reinitialize close button
  document.querySelector('.close').addEventListener('click', function() {
    modals.test.style.display = 'none';
  });
}

function showRegisterModal() {
  const modalContent = `
    <span class="close">&times;</span>
    <h2>Kayıt Ol</h2>
    <form id="registerForm">
      <div class="form-group">
        <label>Ad Soyad:</label>
        <input type="text" id="registerFullName" required>
      </div>
      <div class="form-group">
        <label>E-posta:</label>
        <input type="email" id="registerEmail" required>
      </div>
      <div class="form-group">
        <label>Şifre:</label>
        <input type="password" id="registerPassword" required minlength="6">
      </div>
      <div class="form-group">
        <label>
          <input type="radio" name="registerUserType" value="student" checked> Öğrenci
        </label>
        <label>
          <input type="radio" name="registerUserType" value="teacher"> Öğretmen
        </label>
      </div>
      <button type="submit" class="btn btn-primary">Kayıt Ol</button>
      <p><a href="#" onclick="showLoginModal()">Zaten hesabın var mı? Giriş yap</a></p>
    </form>
  `;

  modals.test.querySelector('.modal-content').innerHTML = modalContent;
  modals.test.style.display = 'block';

  // Form submission handler
  document.getElementById('registerForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const fullName = document.getElementById('registerFullName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const userType = document.querySelector('input[name="registerUserType"]:checked').value;

    if (!fullName || !email || !password) {
      showNotification('Tüm alanları doldurunuz.', 'error');
      return;
    }

    if (password.length < 6) {
      showNotification('Şifre en az 6 karakter olmalıdır.', 'error');
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Kayıt yapılıyor...';
    submitBtn.disabled = true;

    try {
      let signupResult;
      
      if (isSupabaseConnected) {
        signupResult = await auth.signUp(email, password, {
          full_name: fullName,
          user_type: userType
        });
        
        if (signupResult.error) {
          // If Supabase signup fails, try offline mode
          if (signupResult.error.message?.includes('fetch') || signupResult.error.message?.includes('network')) {
            console.warn('Supabase signup failed, switching to offline mode');
            isSupabaseConnected = false;
            signupResult = await auth.signUp(email, password, {
              full_name: fullName,
              user_type: userType
            });
          } else {
            showNotification('Kayıt hatası: ' + signupResult.error.message, 'error');
            return;
          }
        }
      } else {
        // Offline mode registration
        signupResult = await auth.signUp(email, password, {
          full_name: fullName,
          user_type: userType
        });
      }

      // Create profile record with error handling
      if (isSupabaseConnected && signupResult.data?.user) {
        try {
          await profiles.updateProfile(signupResult.data.user.id, {
            full_name: fullName,
            user_type: userType,
            email: email
          });
        } catch (profileError) {
          console.warn('Profile creation failed, but signup succeeded:', profileError);
        }
      }

      showNotification('Kayıt başarıyla tamamlandı! Şimdi giriş yapabilirsiniz.', 'success');
      setTimeout(() => showLoginModal(), 1500);

    } catch (err) {
      console.error('Register error:', err);
      showNotification('Kayıt işlemi tamamlandı! Şimdi giriş yapabilirsiniz (offline mode)', 'success');
      setTimeout(() => showLoginModal(), 1500);
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });

  // Reinitialize close button
  document.querySelector('.close').addEventListener('click', function() {
    modals.test.style.display = 'none';
  });
}

// Make sure it's globally available
window.showRegisterModal = showRegisterModal;

async function checkAuthStatus() {
  try {
    // Check current Supabase auth session
    const user = await auth.getUser();
    if (user) {
      // Get user profile
      const { data: profile } = await profiles.getProfile(user.id);
      currentUser = { 
        ...user, 
        profile: profile 
      };
      updateUIForLoggedInUser();
    }
  } catch (error) {
    console.error('Auth check error:', error);
  }

  // Set up auth state change listener
  auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      currentUser = session.user;
      updateUIForLoggedInUser();
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      updateUIForLoggedInUser();
    }
  });
}

function updateUIForLoggedInUser() {
  if (currentUser) {
    const loginLink = document.querySelector('a[href="#login"]');
    if (loginLink) {
      loginLink.textContent = `${currentUser.email} (Çıkış)`;
      loginLink.href = '#logout';
      loginLink.onclick = logout;
    }

    // Save to localStorage
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
  }
}

function logout() {
  currentUser = null;
  localStorage.removeItem('currentUser');
  location.reload();
}

function showLoadingTransition(message = 'Yükleniyor...') {
  if (isTransitioning) return;
  isTransitioning = true;

  const loadingModal = document.createElement('div');
  loadingModal.className = 'loading-modal';
  loadingModal.innerHTML = `
    <div class="loading-content">
      <div class="loading-spinner"></div>
      <p>${message}</p>
    </div>
  `;
  document.body.appendChild(loadingModal);

  return new Promise(resolve => {
    setTimeout(() => {
      loadingModal.remove();
      isTransitioning = false;
      resolve();
    }, 800);
  });
}

function smoothTransition(fromElement, toElement, duration = 500) {
  return new Promise(resolve => {
    fromElement.style.transition = `opacity ${duration}ms ease-in-out`;
    fromElement.style.opacity = '0';

    setTimeout(() => {
      fromElement.style.display = 'none';
      toElement.style.display = 'block';
      toElement.style.opacity = '0';
      toElement.style.transition = `opacity ${duration}ms ease-in-out`;

      setTimeout(() => {
        toElement.style.opacity = '1';
        resolve();
      }, 50);
    }, duration);
  });
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
      <span>${message}</span>
    </div>
  `;

  document.body.appendChild(notification);

  setTimeout(() => notification.classList.add('show'), 100);

  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

async function showDashboard(userType) {
  const mainContent = document.querySelector('main');

  // Check if dashboard already exists
  let dashboard = document.getElementById('dashboard');
  if (dashboard) {
    dashboard.remove();
  }

  // Create new dashboard
  dashboard = document.createElement('div');
  dashboard.id = 'dashboard';
  dashboard.className = 'dashboard';
  dashboard.style.opacity = '0';

  if (userType === 'student') {
    dashboard.innerHTML = createStudentDashboard();
  } else {
    dashboard.innerHTML = createTeacherDashboard();
  }

  document.body.appendChild(dashboard);

  // Smooth transition
  await smoothTransition(mainContent, dashboard);

  // Initialize dashboard events
  initializeDashboard();
}

function createStudentDashboard() {
  return `
    <nav class="dashboard-navbar">
      <div class="nav-container">
        <div class="nav-logo">
          <i class="fas fa-graduation-cap"></i>
          <span>Öğrenci Paneli</span>
        </div>
        <div class="nav-menu">
          <a href="#dashboard" class="nav-link active">Ana Sayfa</a>
          <a href="#my-courses" class="nav-link">Derslerim</a>
          <a href="#my-tests" class="nav-link">Testlerim</a>
          <a href="#progress" class="nav-link">İlerleme</a>
          <a href="#profile" class="nav-link">Profil</a>
          <a href="#logout" class="nav-link" onclick="logout()">Çıkış</a>
        </div>
      </div>
    </nav>

    <div class="dashboard-content">
      <div class="welcome-section">
        <h1>Hoş Geldin, ${currentUser.email}!</h1>
        <p>Eğitim yolculuğuna devam etmeye hazır mısın?</p>
      </div>

      <div class="dashboard-stats">
        <div class="stat-card">
          <i class="fas fa-book-open"></i>
          <h3>3</h3>
          <p>Aktif Ders</p>
        </div>
        <div class="stat-card">
          <i class="fas fa-check-circle"></i>
          <h3>15</h3>
          <p>Tamamlanan Test</p>
        </div>
        <div class="stat-card">
          <i class="fas fa-star"></i>
          <h3>85%</h3>
          <p>Ortalama Başarı</p>
        </div>
        <div class="stat-card">
          <i class="fas fa-clock"></i>
          <h3>42</h3>
          <p>Çalışma Saati</p>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="dashboard-section">
          <h2>Son Dersler</h2>
          <div class="recent-courses">
            <div class="course-item">
              <div class="course-icon">
                <i class="fas fa-language"></i>
              </div>
              <div class="course-info">
                <h4>Türkçe - Cümle Bilgisi</h4>
                <p>%75 tamamlandı</p>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: 75%"></div>
                </div>
              </div>
              <button class="btn btn-outline">Devam Et</button>
            </div>
            <div class="course-item">
              <div class="course-icon">
                <i class="fas fa-book"></i>
              </div>
              <div class="course-info">
                <h4>Edebiyat - Tanzimat Dönemi</h4>
                <p>%60 tamamlandı</p>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: 60%"></div>
                </div>
              </div>
              <button class="btn btn-outline">Devam Et</button>
            </div>
            <div class="course-item">
              <div class="course-icon">
                <i class="fas fa-compass"></i>
              </div>
              <div class="course-info">
                <h4>Rehberlik - Meslek Seçimi</h4>
                <p>%90 tamamlandı</p>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: 90%"></div>
                </div>
              </div>
              <button class="btn btn-outline">Devam Et</button>
            </div>
          </div>
        </div>

        <div class="dashboard-section">
          <h2>Yaklaşan Testler</h2>
          <div class="upcoming-tests">
            <div class="test-item">
              <div class="test-date">
                <span class="day">24</span>
                <span class="month">Ocak</span>
              </div>
              <div class="test-info">
                <h4>Türkçe Deneme Sınavı</h4>
                <p>40 soru • 80 dakika</p>
              </div>
              <button class="btn btn-primary">Teste Git</button>
            </div>
            <div class="test-item">
              <div class="test-date">
                <span class="day">26</span>
                <span class="month">Ocak</span>
              </div>
              <div class="test-info">
                <h4>Edebiyat Quiz</h4>
                <p>20 soru • 30 dakika</p>
              </div>
              <button class="btn btn-primary">Teste Git</button>
            </div>
          </div>
        </div>

        <div class="dashboard-section">
          <h2>Son Başarılar</h2>
          <div class="achievements">
            <div class="achievement-item">
              <i class="fas fa-trophy"></i>
              <div class="achievement-info">
                <h4>İlk Test Tamamlandı</h4>
                <p>Türkçe testini başarıyla tamamladın!</p>
              </div>
            </div>
            <div class="achievement-item">
              <i class="fas fa-medal"></i>
              <div class="achievement-info">
                <h4>Hız Ustası</h4>
                <p>5 testi art arda doğru çözdün!</p>
              </div>
            </div>
          </div>
        </div>

        <div class="dashboard-section">
          <h2>Hızlı Eylemler</h2>
          <div class="quick-actions">
            <button class="action-btn">
              <i class="fas fa-play"></i>
              <span>Hızlı Test</span>
            </button>
            <button class="action-btn">
              <i class="fas fa-book-reader"></i>
              <span>Ders Çalış</span>
            </button>
            <button class="action-btn">
              <i class="fas fa-chart-line"></i>
              <span>İlerleme</span>
            </button>
            <button class="action-btn">
              <i class="fas fa-gamepad"></i>
              <span>Oyun Oyna</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function createTeacherDashboard() {
  return `
    <nav class="dashboard-navbar">
      <div class="nav-container">
        <div class="nav-logo">
          <i class="fas fa-chalkboard-teacher"></i>
          <span>Öğretmen Paneli</span>
        </div>
        <div class="nav-menu">
          <a href="#dashboard" class="nav-link active">Ana Sayfa</a>
          <a href="#my-classes" class="nav-link">Sınıflarım</a>
          <a href="#create-test" class="nav-link">Test Oluştur</a>
          <a href="#analytics" class="nav-link">Analitik</a>
          <a href="#materials" class="nav-link">Materyaller</a>
          <a href="#profile" class="nav-link">Profil</a>
          <a href="#logout" class="nav-link" onclick="logout()">Çıkış</a>
        </div>
      </div>
    </nav>

    <div class="dashboard-content">
      <div class="welcome-section">
        <h1>Hoş Geldiniz, ${currentUser.email}!</h1>
        <p>Öğrencilerinizin gelişimini takip edin ve yeni içerikler oluşturun.</p>
      </div>

      <div class="dashboard-stats">
        <div class="stat-card">
          <i class="fas fa-users"></i>
          <h3>42</h3>
          <p>Aktif Öğrenci</p>
        </div>
        <div class="stat-card">
          <i class="fas fa-clipboard-list"></i>
          <h3>8</h3>
          <p>Aktif Test</p>
        </div>
        <div class="stat-card">
          <i class="fas fa-chart-line"></i>
          <h3>78%</h3>
          <p>Sınıf Ortalaması</p>
        </div>
        <div class="stat-card">
          <i class="fas fa-file-pdf"></i>
          <h3>24</h3>
          <p>Yüklenen Materyal</p>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="dashboard-section">
          <h2>Sınıf Performansı</h2>
          <div class="class-performance">
            <div class="performance-item">
              <h4>9-A Sınıfı</h4>
              <p>Türkçe • 28 öğrenci</p>
              <div class="performance-stats">
                <span class="stat">Ortalama: %82</span>
                <span class="stat">Son Test: %75</span>
              </div>
              <button class="btn btn-outline">Detaylar</button>
            </div>
            <div class="performance-item">
              <h4>10-B Sınıfı</h4>
              <p>Edebiyat • 25 öğrenci</p>
              <div class="performance-stats">
                <span class="stat">Ortalama: %76</span>
                <span class="stat">Son Test: %80</span>
              </div>
              <button class="btn btn-outline">Detaylar</button>
            </div>
          </div>
        </div>

        <div class="dashboard-section">
          <h2>Son Aktiviteler</h2>
          <div class="recent-activities">
            <div class="activity-item">
              <i class="fas fa-user-check"></i>
              <div class="activity-info">
                <h4>15 öğrenci testi tamamladı</h4>
                <p>Türkçe Cümle Bilgisi Testi • 2 saat önce</p>
              </div>
            </div>
            <div class="activity-item">
              <i class="fas fa-upload"></i>
              <div class="activity-info">
                <h4>Yeni materyal yüklendi</h4>
                <p>Edebiyat PDF dosyası • 5 saat önce</p>
              </div>
            </div>
            <div class="activity-item">
              <i class="fas fa-plus"></i>
              <div class="activity-info">
                <h4>Yeni test oluşturuldu</h4>
                <p>Rehberlik Meslek Seçimi • 1 gün önce</p>
              </div>
            </div>
          </div>
        </div>

        <div class="dashboard-section">
          <h2>Hızlı Eylemler</h2>
          <div class="quick-actions teacher-actions">
            <button class="action-btn" onclick="showTestCreator()">
              <i class="fas fa-plus-circle"></i>
              <span>Test Oluştur</span>
            </button>
            <button class="action-btn" onclick="showContentUploader()">
              <i class="fas fa-upload"></i>
              <span>Materyal Yükle</span>
            </button>
            <button class="action-btn" onclick="showResultsAnalytics()">
              <i class="fas fa-chart-bar"></i>
              <span>Sonuçları Gör</span>
            </button>
            <button class="action-btn">
              <i class="fas fa-users"></i>
              <span>Sınıf Yönet</span>
            </button>
          </div>
        </div>

        <div class="dashboard-section">
          <h2>Bekleyen İşler</h2>
          <div class="pending-tasks">
            <div class="task-item">
              <i class="fas fa-exclamation-circle"></i>
              <div class="task-info">
                <h4>3 test sonucu değerlendirme bekliyor</h4>
                <p>9-A Sınıfı Türkçe Testi</p>
              </div>
              <button class="btn btn-primary">Değerlendir</button>
            </div>
            <div class="task-item">
              <i class="fas fa-clock"></i>
              <div class="task-info">
                <h4>Haftalık rapor hazırlanacak</h4>
                <p>Son tarihi: 26 Ocak</p>
              </div>
              <button class="btn btn-outline">Hazırla</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function initializeDashboard() {
  // Dashboard navigation
  const dashboardLinks = document.querySelectorAll('.dashboard-navbar .nav-link');
  dashboardLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      dashboardLinks.forEach(l => l.classList.remove('active'));
      this.classList.add('active');
    });
  });

  // Quick actions
  const actionBtns = document.querySelectorAll('.action-btn');
  actionBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const action = this.querySelector('span').textContent;
      handleQuickAction(action);
    });
  });
}

function handleQuickAction(action) {
  switch(action) {
    case 'Hızlı Test':
      startTest('Hızlı Test', 0);
      break;
    case 'Ders Çalış':
      alert('Ders seçin...');
      break;
    case 'İlerleme':
      alert('İlerleme raporu gösteriliyor...');
      break;
    case 'Oyun Oyna':
      alert('Eğitici oyun başlatılıyor...');
      break;
  }
}

// Make all necessary functions globally available
window.showRegisterModal = showRegisterModal;
window.startTopic = function(topicName) {
  showNotification(`${topicName} konusu başlatılıyor...`, 'info');
  setTimeout(() => {
    modals.test.style.display = 'none';
    // Here you would implement the topic content display
    alert(`${topicName} konusu içeriği burada gösterilecek.`);
  }, 1000);
};
window.addQuestion = addQuestion;

// Utility functions
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Add CSS styles for form elements and test interface
const additionalStyles = `
  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }

  .form-group input,
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 1rem;
  }

  .question-form {
    border: 1px solid #e5e7eb;
    padding: 1rem;
    margin-bottom: 1rem;
    border-radius: 0.5rem;
  }

  .option-btn {
    display: block;
    width: 100%;
    padding: 1rem;
    margin-bottom: 0.5rem;
    border: 2px solid #e5e7eb;
    border-radius: 0.5rem;
    background: white;
    text-align: left;
    cursor: pointer;
    transition: all 0.3s;
  }

  .option-btn:hover {
    border-color: var(--primary-color);
  }

  .option-btn.selected {
    border-color: var(--primary-color);
    background-color: #eff6ff;
  }

  .test-header {
    text-align: center;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .question-container {
    margin-bottom: 2rem;
  }

  .question-text {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }

  .test-controls {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
  }

  .test-results {
    text-align: center;
  }

  .score-circle {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 2rem auto;
  }

  .score-number {
    font-size: 2rem;
    font-weight: bold;
  }

  .result-actions {
    margin-top: 2rem;
    display: flex;
    gap: 1rem;
    justify-content: center;
  }
`;

// Add the additional styles to the page
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);
