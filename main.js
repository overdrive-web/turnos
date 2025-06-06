const loadingScreen = document.getElementById('loadingScreen');
const headerDate = document.querySelector('.header-date');
const userName = document.getElementById('userName');
const userLogo = document.getElementById('userLogo');
const userDropdown = document.getElementById('userDropdown');
const toggleModeBtn = document.getElementById('toggle-mode');
const sidebarMenu = document.querySelector('.sidebar-menu');
const sidebarTitle = document.querySelector('.sidebar-title');
const logoutModal = document.getElementById('logoutModal');
const confirmLogout = document.getElementById('confirmLogout');
const cancelLogout = document.getElementById('cancelLogout');
const content = document.querySelector('.content');

const menuData = [
  {
    name: 'Generador de Turnos',
    icon: 'fa-calendar-check',
    html: 'module/generador/generador.html',
    css: 'module/generador/generador.css',
    js: 'module/generador/generador.js'
  },
  {
    name: 'Horarios',
    icon: 'fa-clock',
    html: 'module/horarios/horarios.html',
    css: 'module/horarios/horarios.css',
    js: 'module/horarios/horarios.js'
  },
  {
    name: 'Colaboradores',
    icon: 'fa-users',
    html: 'module/colaboradores/colaboradores.html',
    css: 'module/colaboradores/colaboradores.css',
    js: 'module/colaboradores/colaboradores.js'
  },
  {
    name: 'Patrones de Turnos',
    icon: 'fa-cogs',
    html: 'module/definir_turnos/definir_turnos.html',
    css: 'module/definir_turnos/definir_turnos.css',
    js: 'module/definir_turnos/definir_turnos.js'
  },
  {
    name: 'Resumen',
    icon: 'fa-chart-bar',
    html: 'module/resumen/resumen.html',
    css: 'module/resumen/resumen.css',
    js: 'module/resumen/resumen.js'
  }
];

function renderSidebarMenu() {
  if (!sidebarMenu) return;
  sidebarMenu.innerHTML = '';
  menuData.forEach(item => {
    const li = document.createElement('li');
    li.classList.add('sidebar-menu-item');
    li.innerHTML = `<i class="fas ${item.icon} sidebar-icon"></i><span class="sidebar-text">${item.name}</span>`;
    li.addEventListener('click', () => loadContent(item.html, item.css, item.js));
    sidebarMenu.appendChild(li);
  });
}

async function loadContent(htmlFile, cssFile, jsFile) {
  try {
    if (!content) throw new Error('Elemento .content no encontrado');
    const cleanupEvent = new CustomEvent('moduleCleanup');
    window.dispatchEvent(cleanupEvent);

    content.innerHTML = '';
    const existingStyles = document.querySelectorAll('style[data-submodule]');
    existingStyles.forEach(style => style.remove());
    const existingScripts = document.querySelectorAll('script[data-submodule]');
    existingScripts.forEach(script => script.remove());

    const cachedHtml = localStorage.getItem(`cached_${htmlFile}`);
    const cachedCss = localStorage.getItem(`cached_${cssFile}`);
    let htmlContent, cssContent;

    htmlContent = cachedHtml || await (await fetch(htmlFile)).text();
    cssContent = cachedCss || await (await fetch(cssFile)).text();

    if (!htmlContent || !cssContent) {
      throw new Error('Contenido HTML o CSS vacío');
    }

    if (!cachedHtml) localStorage.setItem(`cached_${htmlFile}`, htmlContent);
    if (!cachedCss) localStorage.setItem(`cached_${cssFile}`, cssContent);

    content.innerHTML = htmlContent;

    const style = document.createElement('style');
    style.setAttribute('data-submodule', htmlFile);
    style.textContent = cssContent;
    document.head.appendChild(style);

    await new Promise((resolve, reject) => {
      const maxAttempts = 100;
      let attempts = 0;
      const checkDOM = () => {
        if (document.querySelector('.content-container') || content.innerHTML) {
          resolve();
        } else if (attempts >= maxAttempts) {
          reject(new Error('Timeout esperando el DOM'));
        } else {
          attempts++;
          setTimeout(checkDOM, 10);
        }
      };
      checkDOM();
    });

    const script = document.createElement('script');
    script.setAttribute('data-submodule', htmlFile);
    script.type = 'module';
    const timestamp = new Date().getTime();
    script.src = `${jsFile}?t=${timestamp}`;
    script.onerror = (error) => {
      content.innerHTML = `<h2>Error</h2><p>No se pudo cargar el script: ${error.message}</p>`;
    };
    document.body.appendChild(script);
  } catch (error) {
    content.innerHTML = `<h2>Error</h2><p>No se pudo cargar el contenido: ${error.message}</p>`;
  }
}

function initializeApp() {
  if (loadingScreen) loadingScreen.style.display = 'flex';
  renderSidebarMenu();
  loadContent(
    'module/generador/generador.html',
    'module/generador/generador.css',
    'module/generador/generador.js'
  ).then(() => {
    if (loadingScreen) loadingScreen.style.display = 'none';
  });
}

const updateDate = () => {
  const date = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  if (headerDate) headerDate.textContent = date.toLocaleDateString('es-ES', options);
};
updateDate();

if (toggleModeBtn) {
  toggleModeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const icon = toggleModeBtn.querySelector('i');
    if (icon) {
      icon.classList.toggle('fa-sun');
      icon.classList.toggle('fa-moon');
    }
  });
}

if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.body.classList.add('dark-mode');
  if (toggleModeBtn) toggleModeBtn.querySelector('i').classList.replace('fa-sun', 'fa-moon');
}

if (userLogo) {
  userLogo.addEventListener('click', () => {
    if (userDropdown) userDropdown.style.display = userDropdown.style.display === 'none' ? 'block' : 'none';
  });
}

if (userName) {
  userName.addEventListener('click', () => {
    if (userDropdown) userDropdown.style.display = userDropdown.style.display === 'none' ? 'block' : 'none';
  });
}

document.addEventListener('click', (e) => {
  if (userLogo && userName && userDropdown && !userLogo.contains(e.target) && !userName.contains(e.target) && !userDropdown.contains(e.target)) {
    userDropdown.style.display = 'none';
  }
});

document.querySelectorAll('.dropdown-item').forEach(item => {
  item.addEventListener('click', () => {
    const action = item.getAttribute('data-action');
    switch (action) {
      case 'personal-data':
        loadContent(
          'module/info/datos-personales/datos_personales.html',
          'module/info/datos-personales/datos_personales.css',
          'module/info/datos-personales/datos_personales.js'
        );
        break;
      case 'logout':
        if (logoutModal) logoutModal.style.display = 'flex';
        break;
    }
    if (userDropdown) userDropdown.style.display = 'none';
  });
});

if (confirmLogout) {
  confirmLogout.addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'index.html';
  });
}

if (cancelLogout) {
  cancelLogout.addEventListener('click', () => {
    if (logoutModal) logoutModal.style.display = 'none';
  });
}

if (logoutModal) {
  logoutModal.addEventListener('click', (e) => {
    if (e.target === logoutModal) {
      logoutModal.style.display = 'none';
    }
  });
}

initializeApp();
