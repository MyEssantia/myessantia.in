// ========== FIREBASE CONFIGURATION ==========
const firebaseConfig = {
  apiKey: "AIzaSyD16uGnm1vodkbqGoFSdFdJjGFSLpJmflk",
  authDomain: "myessantia.firebaseapp.com",
  projectId: "myessantia",
  storageBucket: "myessantia.firebasestorage.app",
  messagingSenderId: "701726517205",
  appId: "1:701726517205:web:f6ab79efdffeab6dbbbf5c",
  measurementId: "G-SZF11SHZBH"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ========== GLOBAL VARIABLES ==========
let cart = [];
let currentUser = null;
let products = [];

// ========== LOAD CART FROM LOCALSTORAGE ON INIT ==========
function loadCartFromLocalStorage() {
  try {
    const savedCart = localStorage.getItem('MyEssantia_cart');
    if (savedCart) {
      cart = JSON.parse(savedCart);
      console.log('Cart loaded from localStorage:', cart);
    } else {
      console.log('No cart found in localStorage');
    }
  } catch (error) {
    console.error('Error loading cart from localStorage:', error);
    cart = [];
  }
}

// ========== SAVE CART TO LOCALSTORAGE ==========
function saveCartToLocalStorage() {
  try {
    localStorage.setItem('MyEssantia_cart', JSON.stringify(cart));
    console.log('Cart saved to localStorage:', cart);
  } catch (error) {
    console.error('Error saving cart to localStorage:', error);
  }
}

// Load cart from localStorage immediately when script runs
loadCartFromLocalStorage();

// ========== FIREBASE AUTH STATE OBSERVER ==========
auth.onAuthStateChanged(async (user) => {
  console.log('Auth state changed:', user ? 'Logged in' : 'Logged out');
  if (user) {
    currentUser = {
      uid: user.uid,
      name: user.displayName || user.email.split('@')[0],
      email: user.email,
      picture: user.photoURL || 'https://via.placeholder.com/80',
      provider: user.providerData[0]?.providerId || 'email',
      memberSince: user.metadata.creationTime
    };
    
    localStorage.setItem('MyEssantia_user', JSON.stringify(currentUser));
    
    // Load user's cart from Firestore and merge with local cart
    await loadUserCart(user.uid);
    
    // Load products from Firestore
    await loadProducts();
    
    updateProfileIcon();
    if (document.getElementById('profile-content')) {
      renderProfileContent();
    }
    
    // Update cart count after everything is loaded
    updateCartCount();
  } else {
    currentUser = null;
    localStorage.removeItem('MyEssantia_user');
    // Don't clear cart when user logs out - keep local cart
    updateProfileIcon();
    if (document.getElementById('profile-content')) {
      renderProfileContent();
    }
  }
});

// ========== FIREBASE DATA FUNCTIONS ==========
async function loadUserCart(userId) {
  try {
    const cartDoc = await db.collection('carts').doc(userId).get();
    let firebaseCart = [];
    
    if (cartDoc.exists) {
      firebaseCart = cartDoc.data().items || [];
      console.log('Firebase cart loaded:', firebaseCart);
    }
    
    // Merge Firebase cart with local cart if both exist
    if (firebaseCart.length > 0 && cart.length > 0) {
      // Merge carts (prefer Firebase cart for logged in user)
      cart = mergeCarts(cart, firebaseCart);
      console.log('Carts merged:', cart);
    } else if (firebaseCart.length > 0) {
      // Use Firebase cart if it exists
      cart = firebaseCart;
      console.log('Using Firebase cart:', cart);
    }
    // Otherwise keep local cart
    
    // Save merged cart to localStorage
    saveCartToLocalStorage();
    
    updateCartCount();
  } catch (error) {
    console.error('Error loading cart:', error);
    // Keep using local cart if Firebase fails
    updateCartCount();
  }
}

// ========== MERGE CARTS FUNCTION ==========
function mergeCarts(localCart, firebaseCart) {
  const merged = [...firebaseCart];
  
  localCart.forEach(localItem => {
    const existingItem = merged.find(item => item.id === localItem.id);
    if (existingItem) {
      // Take the higher quantity
      existingItem.quantity = Math.max(existingItem.quantity, localItem.quantity);
    } else {
      merged.push(localItem);
    }
  });
  
  return merged;
}

async function saveCartToFirebase() {
  if (!currentUser) return;
  
  try {
    await db.collection('carts').doc(currentUser.uid).set({
      items: cart,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    console.log('Cart saved to Firebase');
    // Also save to localStorage as backup
    saveCartToLocalStorage();
  } catch (error) {
    console.error('Error saving cart to Firebase:', error);
    // Still save to localStorage even if Firebase fails
    saveCartToLocalStorage();
  }
}

async function loadProducts() {
  try {
    const productsSnapshot = await db.collection('products').get();
    products = productsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log('Products loaded:', products.length);
    
    // Cache products in localStorage for offline access
    localStorage.setItem('MyEssantia_products', JSON.stringify(products));
  } catch (error) {
    console.error('Error loading products:', error);
    // Fallback to localStorage if Firebase fails
    const cached = localStorage.getItem('MyEssantia_products');
    products = cached ? JSON.parse(cached) : [];
    console.log('Products loaded from cache:', products.length);
  }
}

// ========== UTILITY FUNCTIONS ==========
function formatPrice(price) {
  return price.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

function renderRating(rating) {
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    if (rating >= i) stars += '<i class="fa-solid fa-star"></i>';
    else if (rating > i - 1 && rating < i) stars += '<i class="fa-solid fa-star-half-alt"></i>';
    else stars += '<i class="fa-regular fa-star"></i>';
  }
  return stars + `<span>(${rating.toFixed(1)})</span>`;
}

function getStockStatus(stock) {
  if (stock > 10) return '<span class="stock-badge in-stock">In Stock</span>';
  if (stock > 0) return `<span class="stock-badge low-stock">Only ${stock} left</span>`;
  return '<span class="stock-badge out-of-stock">Out of Stock</span>';
}

// ========== FALLBACK COMPONENTS ==========
function getFallbackHeader() {
  return `
    <header style="padding: 1rem; background: #fff; border-bottom: 1px solid #eee;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div class="logo" style="font-family: 'Playfair Display', serif; font-size: 1.8rem;">
          My<span style="color: #d4af37;">Essantia</span>
        </div>
        <div class="header-icons">
          <a href="#" id="profile-icon" style="margin: 0 0.5rem;"><i class="fa-regular fa-user"></i></a>
          <a href="#" id="cart-icon" style="margin: 0 0.5rem; position: relative;">
            <i class="fa-regular fa-shopping-bag"></i>
            <span id="cart-count" style="position: absolute; top: -8px; right: -8px; background: #d4af37; color: #fff; border-radius: 50%; width: 18px; height: 18px; font-size: 11px; display: flex; align-items: center; justify-content: center;">0</span>
          </a>
        </div>
      </div>
    </header>
  `;
}

function getFallbackFooter() {
  return `
    <footer style="background: #1a1a1a; color: #fff; padding: 2rem 1rem; margin-top: 3rem;">
      <div style="text-align: center;">
        <p>&copy; 2025 MyEssantia. All rights reserved.</p>
      </div>
    </footer>
  `;
}

// ========== COMPONENT LOADING ==========
async function loadComponents() {
  try {
    const headerResponse = await fetch('header.html');
    const headerData = await headerResponse.text();
    document.getElementById('header').innerHTML = headerData;

    const footerResponse = await fetch('footer.html');
    const footerData = await footerResponse.text();
    document.getElementById('footer').innerHTML = footerData;

    // Load products after components are loaded
    await loadProducts();

    setTimeout(() => {
      if (typeof initializeApp === 'function') {
        initializeApp();
      }
      setupEventListeners();
      // Update cart count after components are loaded
      updateCartCount();
    }, 50);
  } catch (error) {
    console.error('Error loading components:', error);
    document.getElementById('header').innerHTML = getFallbackHeader();
    document.getElementById('footer').innerHTML = getFallbackFooter();
    
    // Fallback to cached products
    const cached = localStorage.getItem('MyEssantia_products');
    products = cached ? JSON.parse(cached) : [];
    
    setTimeout(() => {
      if (typeof initializeApp === 'function') {
        initializeApp();
      }
      setupEventListeners();
      // Update cart count
      updateCartCount();
    }, 50);
  }
}

// ========== EVENT LISTENERS SETUP ==========
function setupEventListeners() {
  console.log('Setting up event listeners');
  
  // Mobile menu elements
  const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
  const mobileDropdown = document.getElementById('mobileDropdown');
  const mobileMenuClose = document.getElementById('mobileMenuClose');
  
  if (mobileMenuToggle && mobileDropdown) {
    // Open menu on hamburger click
    mobileMenuToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      this.classList.toggle('active');
      mobileDropdown.classList.toggle('show');
      
      if (mobileDropdown.classList.contains('show')) {
        document.body.classList.add('menu-open');
        document.body.style.overflow = 'hidden';
      } else {
        document.body.classList.remove('menu-open');
        document.body.style.overflow = '';
      }
    });

    // Close menu with close button
    if (mobileMenuClose) {
      mobileMenuClose.addEventListener('click', function() {
        mobileMenuToggle.classList.remove('active');
        mobileDropdown.classList.remove('show');
        document.body.classList.remove('menu-open');
        document.body.style.overflow = '';
      });
    }

    // Close menu when clicking on a navigation link
    const mobileLinks = document.querySelectorAll('.mobile-menu-link');
    mobileLinks.forEach(link => {
      link.addEventListener('click', () => {
        mobileMenuToggle.classList.remove('active');
        mobileDropdown.classList.remove('show');
        document.body.classList.remove('menu-open');
        document.body.style.overflow = '';
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
      if (mobileDropdown.classList.contains('show')) {
        if (!mobileDropdown.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
          mobileMenuToggle.classList.remove('active');
          mobileDropdown.classList.remove('show');
          document.body.classList.remove('menu-open');
          document.body.style.overflow = '';
        }
      }
    });
  }

  // Use event delegation for cart icon
  document.addEventListener('click', function(e) {
    const cartIcon = e.target.closest('#cart-icon');
    if (cartIcon) {
      e.preventDefault();
      console.log('Cart icon clicked (delegated)');
      openCart();
      
      // Close mobile menu if open
      if (mobileDropdown && mobileDropdown.classList.contains('show')) {
        mobileMenuToggle?.classList.remove('active');
        mobileDropdown.classList.remove('show');
        document.body.classList.remove('menu-open');
        document.body.style.overflow = '';
      }
    }
  });

  document.addEventListener('click', function(e) {
    const profileIcon = e.target.closest('#profile-icon');
    if (profileIcon) {
      e.preventDefault();
      console.log('Profile icon clicked (delegated)');
      openProfile();
      
      // Close mobile menu if open
      if (mobileDropdown && mobileDropdown.classList.contains('show')) {
        mobileMenuToggle?.classList.remove('active');
        mobileDropdown.classList.remove('show');
        document.body.classList.remove('menu-open');
        document.body.style.overflow = '';
      }
    }
  });

  // These will be set up again when modals are loaded
  const setupModalListeners = () => {
    const closeCart = document.getElementById('close-cart');
    if (closeCart) {
      closeCart.addEventListener('click', function(e) {
        e.preventDefault();
        closeModal('cart-modal');
      });
    }

    const closeProfile = document.getElementById('close-profile');
    if (closeProfile) {
      closeProfile.addEventListener('click', function(e) {
        e.preventDefault();
        closeModal('profile-modal');
      });
    }

    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', function() {
        if (!currentUser) {
          alert('Please login to checkout');
          closeModal('cart-modal');
          openProfile();
          return;
        }
        if (cart.length === 0) {
          alert('Your cart is empty!');
        } else {
          saveCartToLocalStorage();
          if (currentUser) {
            saveCartToFirebase().then(() => {
              closeModal('cart-modal');
              window.location.href = 'checkout.html';
            }).catch(error => {
              console.error('Error saving cart before redirect:', error);
              closeModal('cart-modal');
              window.location.href = 'checkout.html';
            });
          } else {
            closeModal('cart-modal');
            window.location.href = 'checkout.html';
          }
        }
      });
    }
  };

  // Try to set up modal listeners immediately
  setupModalListeners();

  window.addEventListener('click', function(e) {
    const cartModal = document.getElementById('cart-modal');
    const profileModal = document.getElementById('profile-modal');
    
    if (e.target === cartModal) {
      closeModal('cart-modal');
    }
    if (e.target === profileModal) {
      closeModal('profile-modal');
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      // Close mobile menu if open
      if (mobileDropdown && mobileDropdown.classList.contains('show')) {
        mobileMenuToggle?.classList.remove('active');
        mobileDropdown.classList.remove('show');
        document.body.classList.remove('menu-open');
        document.body.style.overflow = '';
      }
      
      // Close modals
      closeModal('cart-modal');
      closeModal('profile-modal');
    }
  });
  
  // Handle window resize - close mobile menu on resize to desktop
  window.addEventListener('resize', function() {
    if (window.innerWidth > 768) {
      if (mobileDropdown && mobileDropdown.classList.contains('show')) {
        mobileMenuToggle?.classList.remove('active');
        mobileDropdown.classList.remove('show');
        document.body.classList.remove('menu-open');
        document.body.style.overflow = '';
      }
    }
  });
  
  // Setup cart buttons using event delegation
  setupCartButtonListener();
}

// ========== CART BUTTON SETUP (Event Delegation) ==========
function setupCartButtonListener() {
  // Listen for clicks on any button with data-add-to-cart attribute
  document.addEventListener('click', function(e) {
    const button = e.target.closest('[data-add-to-cart]');
    if (button) {
      e.preventDefault();
      const productId = button.getAttribute('data-add-to-cart');
      addToCart(productId, button);
    }
  });
}

// ========== MAIN ADD TO CART FUNCTION (SINGLE SOURCE OF TRUTH) ==========
window.addToCart = async function(productId, button = null) {
  console.log('Adding to cart:', productId);
  
  // If button not provided, try to get it from the event
  if (!button && event) {
    button = event.target?.closest('button');
  }
  
  const product = products.find(p => p.id === productId);
  if (!product) {
    console.error('Product not found:', productId);
    return;
  }

  if (product.stock <= 0) {
    alert('Sorry, this product is out of stock!');
    return;
  }

  const existingItem = cart.find(item => item.id === productId);

  if (existingItem) {
    if (existingItem.quantity >= product.stock) {
      alert('Sorry, not enough stock available!');
      return;
    }
    existingItem.quantity += 1;
    console.log('Updated quantity:', existingItem);
  } else {
    const newItem = {
      id: productId,
      title: product.title,
      category: product.category,
      price: product.price,
      primaryImg: product.primaryImg || (product.images && product.images[0]),
      quantity: 1
    };
    cart.push(newItem);
    console.log('New item added:', newItem);
  }

  // Save to localStorage immediately
  saveCartToLocalStorage();

  // Save to Firebase if user is logged in
  if (currentUser) {
    try {
      await saveCartToFirebase();
    } catch (error) {
      console.error('Error saving to Firebase:', error);
    }
  }
  
  updateCartCount();
  
  // Show animation on the button
  if (button) {
    const originalHTML = button.innerHTML;
    const originalBg = button.style.background;
    const originalColor = button.style.color;
    
    button.innerHTML = '<i class="fa-solid fa-check"></i> Added!';
    button.style.background = '#4CAF50';
    button.style.color = 'white';
    
    setTimeout(() => {
      button.innerHTML = originalHTML;
      button.style.background = originalBg;
      button.style.color = originalColor;
      // Open cart after animation
      console.log('Opening cart after add');
      openCart();
    }, 500);
  } else {
    // Open cart immediately if button not found
    console.log('Opening cart immediately');
    setTimeout(() => openCart(), 300);
  }
};

// Legacy support for onclick="addToCart('id')" - still works!
window.addToCartLegacy = function(productId) {
  window.addToCart(productId, event?.target?.closest('button'));
};

// Buy Now function
window.buyNow = function(productId) {
  window.addToCart(productId, event?.target?.closest('button'));
};

// ========== CART FUNCTIONS ==========
window.updateQuantity = async function(productId, change) {
  console.log('Updating quantity:', productId, change);
  
  const itemIndex = cart.findIndex(item => item.id === productId);
  if (itemIndex === -1) return;

  const product = products.find(p => p.id === productId);
  const item = cart[itemIndex];
  const newQuantity = item.quantity + change;

  if (newQuantity <= 0) {
    cart.splice(itemIndex, 1);
    console.log('Item removed');
  } else if (product && newQuantity > product.stock) {
    alert('Sorry, not enough stock available!');
    return;
  } else {
    item.quantity = newQuantity;
    console.log('Quantity updated to:', newQuantity);
  }

  // Save to localStorage immediately
  saveCartToLocalStorage();

  // Save to Firebase if user is logged in
  if (currentUser) {
    await saveCartToFirebase();
  }
  
  updateCartCount();
  // Re-render cart items when quantity updates
  if (document.getElementById('cart-modal')?.classList.contains('show')) {
    console.log('Re-rendering cart items');
    renderCartItems();
  }
};

window.removeFromCart = async function(productId) {
  console.log('Removing from cart:', productId);
  
  cart = cart.filter(item => item.id !== productId);
  
  // Save to localStorage immediately
  saveCartToLocalStorage();

  // Save to Firebase if user is logged in
  if (currentUser) {
    await saveCartToFirebase();
  }
  
  updateCartCount();
  // Re-render cart items when item is removed
  if (document.getElementById('cart-modal')?.classList.contains('show')) {
    console.log('Re-rendering cart items');
    renderCartItems();
  }
};

function renderCartItems() {
  console.log('Rendering cart items. Cart length:', cart.length);
  
  const cartItemsContainer = document.getElementById('cart-items');
  const cartItemCount = document.getElementById('cart-item-count');
  const cartTotalAmount = document.getElementById('cart-total-amount');

  // Log all cart elements to debug
  console.log('Cart elements:', {
    container: cartItemsContainer,
    countEl: cartItemCount,
    totalEl: cartTotalAmount
  });

  if (!cartItemsContainer) {
    console.error('Cart items container not found!');
    return;
  }

  if (!cart || cart.length === 0) {
    console.log('Cart is empty, showing empty message');
    cartItemsContainer.innerHTML = `
      <div class="empty-cart-message">
        <i class="fa-regular fa-cart-shopping"></i>
        <p>Your cart is empty</p>
        <p style="font-size: 0.9rem; margin-top: 0.5rem;">Start shopping to add items!</p>
      </div>
    `;
    if (cartItemCount) cartItemCount.textContent = '0';
    if (cartTotalAmount) cartTotalAmount.textContent = '₹0.00';
    return;
  }

  let total = 0;
  let totalItems = 0;

  console.log('Cart items to render:', cart);

  const itemsHtml = cart.map(item => {
    const itemTotal = item.price * item.quantity;
    total += itemTotal;
    totalItems += item.quantity;

    return `
      <div class="cart-item">
        <div class="cart-item-image" style="background-image: url('${item.primaryImg || 'https://via.placeholder.com/90'}');"></div>
        <div class="cart-item-details">
          <h4 class="cart-item-title">${item.title}</h4>
          <div class="cart-item-price">₹${formatPrice(item.price)}</div>
          <div class="cart-item-actions">
            <div class="quantity-controls">
              <button class="quantity-btn" onclick="window.updateQuantity('${item.id}', -1)">
                <i class="fa-solid fa-minus"></i>
              </button>
              <span class="quantity-value">${item.quantity}</span>
              <button class="quantity-btn" onclick="window.updateQuantity('${item.id}', 1)">
                <i class="fa-solid fa-plus"></i>
              </button>
            </div>
            <button class="remove-btn" onclick="window.removeFromCart('${item.id}')">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  cartItemsContainer.innerHTML = itemsHtml;
  console.log('Cart HTML rendered');

  if (cartItemCount) cartItemCount.textContent = totalItems;
  if (cartTotalAmount) cartTotalAmount.textContent = `₹${formatPrice(total)}`;
  
  console.log('Cart totals:', { totalItems, total });
}

function updateCartCount() {
  const cartCount = document.getElementById('cart-count');
  if (cartCount) {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;
    console.log('Cart count updated:', totalItems);
  } else {
    console.warn('Cart count element not found');
  }
}

// ========== MODAL FUNCTIONS ==========
function openCart() {
  console.log('Opening cart modal');
  
  const cartModal = document.getElementById('cart-modal');
  if (cartModal) {
    console.log('Cart modal found');
    // Make sure cart items are rendered before showing modal
    renderCartItems();
    
    // Force the modal to be visible
    cartModal.style.display = 'flex';
    cartModal.classList.add('show');
    document.body.style.overflow = 'hidden';
    console.log('Cart modal opened');
  } else {
    console.warn('Cart modal not found, attempting to load');
    // Try to load modals if they're not present
    loadCommonModals().then(() => {
      setTimeout(() => {
        const modal = document.getElementById('cart-modal');
        if (modal) {
          console.log('Cart modal loaded and opened');
          renderCartItems();
          modal.style.display = 'flex';
          modal.classList.add('show');
          document.body.style.overflow = 'hidden';
        } else {
          console.error('Failed to load cart modal');
        }
      }, 100);
    });
  }
}

function openProfile() {
  console.log('Opening profile modal');
  
  const profileModal = document.getElementById('profile-modal');
  if (profileModal) {
    console.log('Profile modal found');
    renderProfileContent();
    profileModal.classList.add('show');
    document.body.style.overflow = 'hidden';
  } else {
    console.warn('Profile modal not found, attempting to load');
    // Try to load modals if they're not present
    loadCommonModals().then(() => {
      setTimeout(() => {
        const modal = document.getElementById('profile-modal');
        if (modal) {
          console.log('Profile modal loaded and opened');
          renderProfileContent();
          modal.classList.add('show');
          document.body.style.overflow = 'hidden';
        } else {
          console.error('Failed to load profile modal');
        }
      }, 100);
    });
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = '';
    modal.classList.remove('show');
    document.body.style.overflow = '';
    console.log('Modal closed:', modalId);
  }
}

// Make modal functions globally available
window.openCart = openCart;
window.closeModal = closeModal;

// ========== LOAD COMMON MODALS ==========
async function loadCommonModals() {
  console.log('Loading common modals');
  
  try {
    // Check if modals already exist
    if (document.getElementById('cart-modal')) {
      console.log('Modals already exist');
      return;
    }
    
    const response = await fetch('common.html');
    const data = await response.text();
    document.getElementById('common-modals').innerHTML = data;
    console.log('Modals loaded from common.html');
    
    // Re-setup event listeners for modal buttons
    setTimeout(() => {
      const closeCart = document.getElementById('close-cart');
      if (closeCart) {
        closeCart.addEventListener('click', (e) => {
          e.preventDefault();
          closeModal('cart-modal');
        });
      }
      
      const closeProfile = document.getElementById('close-profile');
      if (closeProfile) {
        closeProfile.addEventListener('click', (e) => {
          e.preventDefault();
          closeModal('profile-modal');
        });
      }

      const checkoutBtn = document.getElementById('checkout-btn');
      if (checkoutBtn) {
        checkoutBtn.addEventListener('click', function() {
          if (!currentUser) {
            alert('Please login to checkout');
            closeModal('cart-modal');
            openProfile();
            return;
          }
          if (cart.length === 0) {
            alert('Your cart is empty!');
          } else {
            saveCartToLocalStorage();
            if (currentUser) {
              saveCartToFirebase().then(() => {
                closeModal('cart-modal');
                window.location.href = 'checkout.html';
              }).catch(error => {
                console.error('Error saving cart before redirect:', error);
                closeModal('cart-modal');
                window.location.href = 'checkout.html';
              });
            } else {
              closeModal('cart-modal');
              window.location.href = 'checkout.html';
            }
          }
        });
      }
      
      console.log('Modal event listeners setup');
    }, 100);
  } catch (error) {
    console.error('Error loading modals:', error);
  }
}

// ========== PROFILE FUNCTIONS ==========
function renderProfileContent() {
  const profileContent = document.getElementById('profile-content');
  if (!profileContent) return;

  if (currentUser) {
    profileContent.innerHTML = `
      <div class="profile-card">
        <div class="profile-avatar">
          <img src="${currentUser.picture || 'https://via.placeholder.com/150'}"
               alt="Profile"
               style="width:100%;height:100%;object-fit:cover;"
               onerror="this.src='https://via.placeholder.com/150'">
        </div>

        <div class="profile-name">${currentUser.name}</div>
        <div class="profile-email">${currentUser.email}</div>

        <button class="logout-btn" onclick="window.logout()">
          Logout
        </button>
      </div>
    `;
  } else {
    profileContent.innerHTML = `
      <div class="login-wrapper">
        <div class="login-icon">
          <i class="fa-brands fa-google"></i>
        </div>

        <div class="login-title">
          Welcome to <span style="color:#d4af37;">MyEssantia</span>
        </div>

        <div class="login-subtitle">
          Sign in securely with your Google account
        </div>

        <button class="google-login-btn" onclick="window.loginWithGoogle()">
          <i class="fa-brands fa-google"></i>
          Continue with Google
        </button>

        <div class="login-terms">
          By continuing, you agree to our Terms & Privacy Policy
        </div>
      </div>
    `;
  }
}

window.loginWithGoogle = async function() {
  const provider = new firebase.auth.GoogleAuthProvider();
  
  try {
    const result = await auth.signInWithPopup(provider);
    
    const isNewUser = result.additionalUserInfo?.isNewUser;
    
    if (isNewUser) {
      await db.collection('users').doc(result.user.uid).set({
        name: result.user.displayName,
        email: result.user.email,
        photoURL: result.user.photoURL,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    
    closeModal('profile-modal');
  } catch (error) {
    console.error('Google login error:', error);
    let errorMessage = 'Google login failed. Please try again.';
    if (error.code === 'auth/popup-closed-by-user') {
      errorMessage = 'Login cancelled.';
    } else if (error.code === 'auth/popup-blocked') {
      errorMessage = 'Popup was blocked by your browser.';
    }
    alert(errorMessage);
  }
};

window.logout = async function() {
  try {
    await auth.signOut();
    closeModal('profile-modal');
  } catch (error) {
    console.error('Logout error:', error);
    alert('Failed to logout. Please try again.');
  }
};

function updateProfileIcon() {
  const profileIcon = document.getElementById('profile-icon');
  if (profileIcon) {
    if (currentUser) {
      profileIcon.innerHTML = '<i class="fa-solid fa-circle-user" style="color: #d4af37;"></i>';
    } else {
      profileIcon.innerHTML = '<i class="fa-regular fa-user"></i>';
    }
  }
}

// ========== INITIALIZATION ==========
// Setup cart button listener when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM Content Loaded');
  
  // Load modals first
  loadCommonModals().then(() => {
    setupCartButtonListener();
    updateCartCount();
    console.log('Initialization complete');
  });
});

// Also try to load modals on window load
window.addEventListener('load', function() {
  console.log('Window Loaded');
  
  if (!document.getElementById('cart-modal')) {
    console.log('Loading modals on window load');
    loadCommonModals();
  }
  
  // Log cart state on load
  console.log('Current cart on load:', cart);
});
