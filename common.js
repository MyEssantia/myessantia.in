
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
  } catch (error) {
    console.error('Error saving cart to localStorage:', error);
  }
}

// Load cart from localStorage immediately when script runs
loadCartFromLocalStorage();

// ========== FIREBASE AUTH STATE OBSERVER ==========
auth.onAuthStateChanged(async (user) => {
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
    }
    
    // Merge Firebase cart with local cart if both exist
    if (firebaseCart.length > 0 && cart.length > 0) {
      // Merge carts (prefer Firebase cart for logged in user)
      cart = mergeCarts(cart, firebaseCart);
    } else if (firebaseCart.length > 0) {
      // Use Firebase cart if it exists
      cart = firebaseCart;
    }
    // Otherwise keep local cart
    
    // Save merged cart to localStorage
    saveCartToLocalStorage();
    
    updateCartCount();
    renderCartItems();
  } catch (error) {
    console.error('Error loading cart:', error);
    // Keep using local cart if Firebase fails
    updateCartCount();
    renderCartItems();
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
    
    // Cache products in localStorage for offline access
    localStorage.setItem('MyEssantia_products', JSON.stringify(products));
  } catch (error) {
    console.error('Error loading products:', error);
    // Fallback to localStorage if Firebase fails
    products = JSON.parse(localStorage.getItem('MyEssantia_products')) || [];
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
      // Force override any duplicate addToCart functions after components are loaded
      forceOverrideCartFunctions();
      // Update cart count after components are loaded
      updateCartCount();
    }, 50);
  } catch (error) {
    console.error('Error loading components:', error);
    document.getElementById('header').innerHTML = getFallbackHeader();
    document.getElementById('footer').innerHTML = getFallbackFooter();
    
    // Fallback to cached products
    products = JSON.parse(localStorage.getItem('MyEssantia_products')) || [];
    
    setTimeout(() => {
      if (typeof initializeApp === 'function') {
        initializeApp();
      }
      setupEventListeners();
      // Force override any duplicate addToCart functions
      forceOverrideCartFunctions();
      // Update cart count
      updateCartCount();
    }, 50);
  }
}

// ========== EVENT LISTENERS SETUP ==========
function setupEventListeners() {
  const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
  const navMenu = document.getElementById('nav-menu');
  
  if (mobileMenuToggle && navMenu) {
    mobileMenuToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      navMenu.classList.toggle('show');
    });
  }

  const cartIcon = document.getElementById('cart-icon');
  if (cartIcon) {
    cartIcon.addEventListener('click', function(e) {
      e.preventDefault();
      openCart();
    });
  }

  const profileIcon = document.getElementById('profile-icon');
  if (profileIcon) {
    profileIcon.addEventListener('click', function(e) {
      e.preventDefault();
      openProfile();
    });
  }

  const closeCart = document.getElementById('close-cart');
  if (closeCart) {
    closeCart.addEventListener('click', function() {
      closeModal('cart-modal');
    });
  }

  const closeProfile = document.getElementById('close-profile');
  if (closeProfile) {
    closeProfile.addEventListener('click', function() {
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
        // Save cart to localStorage before redirecting
        saveCartToLocalStorage();
        
        // Also save to Firebase if user is logged in
        if (currentUser) {
          saveCartToFirebase().then(() => {
            // Close the cart modal
            closeModal('cart-modal');
            // Redirect to checkout page
            window.location.href = 'checkout.html';
          }).catch(error => {
            console.error('Error saving cart before redirect:', error);
            // Still redirect even if Firebase save fails
            closeModal('cart-modal');
            window.location.href = 'checkout.html';
          });
        } else {
          // Redirect even if not logged in (though we checked currentUser above)
          closeModal('cart-modal');
          window.location.href = 'checkout.html';
        }
      }
    });
  }

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
      closeModal('cart-modal');
      closeModal('profile-modal');
    }
  });

  document.addEventListener('click', function(e) {
    if (navMenu && navMenu.classList.contains('show')) {
      if (!navMenu.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
        navMenu.classList.remove('show');
      }
    }
  });
}

// ========== MODAL FUNCTIONS ==========
function openCart() {
  const cartModal = document.getElementById('cart-modal');
  if (cartModal) {
    renderCartItems();
    cartModal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
}

function openProfile() {
  const profileModal = document.getElementById('profile-modal');
  if (profileModal) {
    renderProfileContent();
    profileModal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
  }
}

// ========== MASTER CART FUNCTION (FORCED OVERRIDE) ==========
// This is the single source of truth for addToCart
const masterAddToCart = async function(productId, shouldOpenCart = true) {
  console.log('Master addToCart called for product:', productId);
  
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
  } else {
    cart.push({
      id: productId,
      title: product.title,
      category: product.category,
      price: product.price,
      primaryImg: product.primaryImg || (product.images && product.images[0]),
      quantity: 1
    });
  }

  // Save to localStorage immediately
  saveCartToLocalStorage();

  // Save to Firebase if user is logged in
  if (currentUser) {
    await saveCartToFirebase();
  }
  
  updateCartCount();
  
  // Show animation on the button
  const btn = event?.target?.closest('button');
  if (btn) {
    const originalText = btn.innerHTML;
    const originalBg = btn.style.background;
    const originalColor = btn.style.color;
    
    btn.innerHTML = '<i class="fa-solid fa-check"></i> added';
    btn.style.background = '#4CAF50';
    btn.style.color = 'white';
    
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.style.background = originalBg;
      btn.style.color = originalColor;
      
      // Open cart after animation if requested
      if (shouldOpenCart) {
        openCart();
      }
    }, 500);
  }
};

// ========== FORCED OVERRIDE FUNCTION ==========
function forceOverrideCartFunctions() {
  console.log('Forcing override of cart functions...');
  
  // Override window.addToCart with master function
  window.addToCart = function(productId) {
    return masterAddToCart(productId, true);
  };
  
  // Override any potential duplicate functions
  window.addToCartMaster = masterAddToCart;
  window.addToCartLegacy = function(productId) {
    return masterAddToCart(productId, false);
  };
  
  // Override buyNow to use master function
  window.buyNow = function(productId) {
    masterAddToCart(productId, true);
  };
  
  // Freeze the functions to prevent further overrides
  Object.defineProperty(window, 'addToCart', {
    value: window.addToCart,
    writable: false,
    configurable: false
  });
  
  Object.defineProperty(window, 'buyNow', {
    value: window.buyNow,
    writable: false,
    configurable: false
  });
  
  console.log('Cart functions forcefully overridden and locked');
}

// ========== CART FUNCTIONS ==========
window.updateQuantity = async function(productId, change) {
  const itemIndex = cart.findIndex(item => item.id === productId);
  if (itemIndex === -1) return;

  const product = products.find(p => p.id === productId);
  const item = cart[itemIndex];
  const newQuantity = item.quantity + change;

  if (newQuantity <= 0) {
    cart.splice(itemIndex, 1);
  } else if (product && newQuantity > product.stock) {
    alert('Sorry, not enough stock available!');
    return;
  } else {
    item.quantity = newQuantity;
  }

  // Save to localStorage immediately
  saveCartToLocalStorage();

  // Save to Firebase if user is logged in
  if (currentUser) {
    await saveCartToFirebase();
  }
  
  updateCartCount();
  renderCartItems();
};

window.removeFromCart = async function(productId) {
  cart = cart.filter(item => item.id !== productId);
  
  // Save to localStorage immediately
  saveCartToLocalStorage();

  // Save to Firebase if user is logged in
  if (currentUser) {
    await saveCartToFirebase();
  }
  
  updateCartCount();
  renderCartItems();
};

function renderCartItems() {
  const cartItemsContainer = document.getElementById('cart-items');
  const cartItemCount = document.getElementById('cart-item-count');
  const cartTotalAmount = document.getElementById('cart-total-amount');

  if (!cartItemsContainer || !cartItemCount || !cartTotalAmount) return;

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="empty-cart-message">
        <i class="fa-regular fa-cart-shopping"></i>
        <p>Your cart is empty</p>
        <p style="font-size: 0.9rem; margin-top: 0.5rem;">Start shopping to add items!</p>
      </div>
    `;
    cartItemCount.textContent = '0';
    cartTotalAmount.textContent = '₹0.00';
    return;
  }

  let total = 0;
  let totalItems = 0;

  cartItemsContainer.innerHTML = cart.map(item => {
    const itemTotal = item.price * item.quantity;
    total += itemTotal;
    totalItems += item.quantity;

    return `
      <div class="cart-item">
        <div class="cart-item-image" style="background-image: url('${item.primaryImg || 'https://via.placeholder.com/60'}');"></div>
        <div class="cart-item-details">
          <h4>${item.title}</h4>
          <p>${item.category}</p>
          <div class="cart-item-price">₹${formatPrice(item.price)}</div>
          <div class="cart-quantity-controls">
            <button class="quantity-btn" onclick="window.updateQuantity('${item.id}', -1)">
              <i class="fa-solid fa-minus"></i>
            </button>
            <span style="min-width: 30px; text-align: center;">${item.quantity}</span>
            <button class="quantity-btn" onclick="window.updateQuantity('${item.id}', 1)">
              <i class="fa-solid fa-plus"></i>
            </button>
            <button class="remove-btn" onclick="window.removeFromCart('${item.id}')">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  cartItemCount.textContent = totalItems;
  cartTotalAmount.textContent = `₹${formatPrice(total)}`;
}

function updateCartCount() {
  const cartCount = document.getElementById('cart-count');
  if (cartCount) {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;
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

// Make all cart functions globally available
window.openCart = openCart;
window.closeModal = closeModal;

// Initial override when script loads
forceOverrideCartFunctions();

// Override again after DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
  forceOverrideCartFunctions();
  // Update cart count when DOM is loaded
  updateCartCount();
});

// Override again after a short delay to catch any late script execution
setTimeout(forceOverrideCartFunctions, 100);
setTimeout(forceOverrideCartFunctions, 500);
setTimeout(forceOverrideCartFunctions, 1000);
