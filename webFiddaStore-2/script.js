// =======================================================
// A. المتغيرات الأساسية وقائمة التخفيضات والثوابت
// =======================================================
let products = [];
let cart = JSON.parse(localStorage.getItem('darfidda_cart')) || []; 
let currentDiscount = 0; 
const DELIVERY_CHARGE = 10.00;
const PROMO_CODES = [
    { code: 'DARFIDDA10', discount: 0.10, message: 'تهانينا! تم تطبيق خصم 10%.' },
    { code: 'WELCOMENEW', discount: 0.20, message: 'تم تطبيق خصم 20% خاص بالزبائن الجدد.' }
];

// =======================================================
// B. قراءة البيانات والتهيئة
// =======================================================
async function fetchProducts() {
    try {
        const response = await fetch('products.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        products = await response.json();
        initializeStore();
    } catch (error) {
        console.error("Could not fetch products:", error);
        document.querySelector('main').innerHTML = `
            <section style="text-align: center; color: red;">
                <h2>⚠️ عذراً! لم نتمكن من تحميل قائمة المنتجات.</h2>
                <p>يرجى التأكد من صحة صيغة ملف products.json ورفعه كاملاً.</p>
            </section>
        `;
    }
}

function initializeStore() {
    renderAllProductSections(); 
    updateCartSummary(); 
    setupEventListeners(); 
}

// =======================================================
// C. وظائف العرض والـ Card Rendering
// =======================================================

function createProductCard(item) {
    const card = document.createElement('div');
    // ليتوافق مع تنسيق HTML: استخدام col-6 الذي سيتم توسيعه في CSS
    card.classList.add('product-card', 'col-6'); 
    
    // الصورة والـ SKU
    card.innerHTML += `<img src="${item.image}" alt="${item.name}" class="product-image">`;
    card.innerHTML += `<p class="product-sku">SKU: ${item.sku}</p>`;

    // الاسم والشارات
    let tagsHTML = '';
    if (item.isNew) tagsHTML += '<span class="tag new-tag">جديد</span>';
    if (item.isBestSeller) tagsHTML += '<span class="tag best-seller-tag">الأكثر مبيعاً</span>';
    card.innerHTML += `<div class="product-tags">${tagsHTML}</div>`;
    card.innerHTML += `<h3 class="product-name">${item.name}</h3>`;

    // عرض الأسعار والخصم
    let priceHTML = '';
    const price = item.discountedPrice || item.originalPrice;

    if (item.discountedPrice && item.discountedPrice < item.originalPrice) {
        priceHTML = `
            <span class="original-price-crossed">${item.originalPrice.toFixed(2)} $</span>
            <span class="discounted-price">${item.discountedPrice.toFixed(2)} $</span>
        `;
    } else {
        priceHTML = `${price.toFixed(2)} $`;
    }
    card.innerHTML += `<p class="product-price">${priceHTML}</p>`;
    
    // زر الإضافة
    const button = document.createElement('button');
    button.dataset.itemId = item.id;
    button.classList.add('cta-button');

    if (item.status === 'available' || item.status === 'few-left') {
        button.textContent = "أضف للسلة";
        // إذا كان يحتاج مقاسات، يفتح نافذة المقاسات
        if (item.sizes && item.sizes.length > 0) {
            button.onclick = () => openSizeModal(item);
        } else {
            button.onclick = () => addToCart(item.id);
        }
    } else if (item.megaCategory === 'coming-soon') { 
        button.textContent = "أعلمني عند الإطلاق";
        button.classList.add('notify-button');
        button.onclick = () => alert(`سنقوم بإنشاء نموذج الإشعار لـ ${item.name}`); 
    } else { 
        button.textContent = "نفد المخزون";
        button.disabled = true;
    }
    
    card.appendChild(button);
    return card;
}

function renderAllProductSections() {
    // نستخدم الـ ID الرئيسي للـ Mega-Category في HTML (مثلاً #fashions)
    const sectionsMap = {
        'fashions': 'fashions-products',
        'accessories': 'accessories-products',
        'library': 'library-products',
        'coming-soon': 'coming-soon-products'
    };

    // تفريغ الأقسام قبل البدء
    Object.values(sectionsMap).forEach(id => {
        const container = document.getElementById(id);
        if (container) container.innerHTML = '';
    });

    products.forEach(item => {
        const containerId = sectionsMap[item.megaCategory];
        const container = document.getElementById(containerId);
        
        if (container) {
            const cardElement = createProductCard(item);
            container.appendChild(cardElement);
        }
    });
}


// =======================================================
// D. وظائف السلة (CART)
// =======================================================

function addToCart(itemId, size = null) {
    const item = products.find(p => p.id === itemId);
    if (!item) return;

    // لإنشاء ID فريد للمنتج في السلة إذا كان له مقاس
    const cartItemId = `${itemId}${size ? '-' + size : ''}`;
    
    const existingCartItem = cart.find(c => c.cartId === cartItemId);

    if (existingCartItem) {
        existingCartItem.quantity += 1;
    } else {
        const price = item.discountedPrice || item.originalPrice;
        cart.push({
            cartId: cartItemId,
            id: itemId,
            name: item.name,
            price: price,
            quantity: 1,
            size: size
        });
    }

    localStorage.setItem('darfidda_cart', JSON.stringify(cart));
    updateCartSummary();
    // إخفاء الـ modal إذا تمت الإضافة بنجاح من هناك
    document.getElementById('size-modal').style.display = 'none';
    alert(`تمت إضافة ${item.name} ${size ? '(' + size + ')' : ''} إلى السلة!`);
}

function removeItemFromCart(cartId) {
    cart = cart.filter(item => item.cartId !== cartId);
    localStorage.setItem('darfidda_cart', JSON.stringify(cart));
    updateCartSummary();
    renderCartDetails();
}

function calculateTotal() {
    const subTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountAmount = subTotal * currentDiscount;
    const discountedTotal = subTotal - discountAmount;
    const finalTotal = discountedTotal + DELIVERY_CHARGE;

    return { subTotal, discountAmount, discountedTotal, finalTotal };
}

function updateCartSummary() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totals = calculateTotal();

    // تحديث زر السلة الرئيسي
    const cartButton = document.getElementById('cart-button');
    if (cartButton) {
        document.getElementById('cart-count').textContent = count;
        document.getElementById('cart-total').textContent = totals.finalTotal.toFixed(2);
    }
    
    // إظهار أو إخفاء قسم السلة وتحديث تفاصيله
    const cartDetailsSection = document.getElementById('cart');
    if (cartDetailsSection) {
        cartDetailsSection.style.display = count > 0 ? 'block' : 'none';
        if (count > 0) renderCartDetails();
    }
}

function renderCartDetails() {
    const cartSummaryDiv = document.querySelector('#cart .cart-summary');
    if (!cartSummaryDiv) return;

    cartSummaryDiv.innerHTML = '';
    
    let itemsHtml = '<ul style="list-style: none; padding: 0;">';
    cart.forEach(item => {
        itemsHtml += `
            <li style="border-bottom: 1px dashed #ccc; padding: 10px 0; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>${item.name}</strong> ${item.size ? '(' + item.size + ')' : ''} <br>
                    <span style="font-size: 0.9em; color: #555;">العدد: ${item.quantity} × ${item.price.toFixed(2)} $</span>
                </div>
                <div>
                    <span style="font-weight: bold;">${(item.price * item.quantity).toFixed(2)} $</span>
                    <button class="remove-item-btn" onclick="removeItemFromCart('${item.cartId}')" style="margin-right: 10px; background: none; border: none; color: red; cursor: pointer;">&times;</button>
                </div>
            </li>
        `;
    });
    itemsHtml += '</ul>';

    const totals = calculateTotal();
    
    // منطقة الإجماليات وزر الدفع
    const summaryHtml = `
        <div style="margin-top: 20px; text-align: left;">
            <p><strong>الإجمالي الفرعي:</strong> ${totals.subTotal.toFixed(2)} $</p>
            ${totals.discountAmount > 0 ? `<p style="color: green;"><strong>الخصم المطبق:</strong> - ${totals.discountAmount.toFixed(2)} $</p>` : ''}
            <p><strong>تكلفة التوصيل:</strong> ${DELIVERY_CHARGE.toFixed(2)} $</p>
            <h3 style="color: #44563C;">الإجمالي النهائي: ${totals.finalTotal.toFixed(2)} $</h3>
        </div>
        <button onclick="openCheckoutModal()" class="cta-button" style="width: 100%; margin-top: 15px;">
            إتمام عملية الشراء والدفع
        </button>
    `;
    
    cartSummaryDiv.innerHTML += itemsHtml + summaryHtml;
}


// =======================================================
// E. وظائف الخصم والدفع (CHECKOUT)
// =======================================================

function applyPromoCode() {
    const promoCodeInput = document.getElementById('promo-code');
    const promoMessage = document.getElementById('promo-message');
    const code = promoCodeInput.value.trim().toUpperCase();
    const promo = PROMO_CODES.find(p => p.code === code);

    currentDiscount = 0; 

    if (promo) {
        currentDiscount = promo.discount;
        promoMessage.textContent = promo.message;
        promoMessage.style.color = 'green';
        document.getElementById('applied-promo-code').value = code;
    } else {
        promoMessage.textContent = 'رمز الخصم غير صالح.';
        promoMessage.style.color = 'red';
        document.getElementById('applied-promo-code').value = '';
    }

    updateCheckoutTotals();
}

function updateCheckoutTotals() {
    const totals = calculateTotal();
    
    document.getElementById('modal-order-total').textContent = totals.discountedTotal.toFixed(2) + ' $';
    document.getElementById('modal-delivery-charge').textContent = DELIVERY_CHARGE.toFixed(2) + ' $';
    document.getElementById('modal-final-total').textContent = totals.finalTotal.toFixed(2) + ' $';

    // تحديث ملخص الطلب المخفي لـ Formspree
    let summaryText = '--- تفاصيل طلب دار فضة ---\n';
    cart.forEach(item => {
        summaryText += `${item.name} (${item.size || 'لا يوجد مقاس'}) x${item.quantity} @ ${item.price.toFixed(2)}$\n`;
    });
    summaryText += `\nالإجمالي الفرعي: ${totals.subTotal.toFixed(2)}$`;
    if (totals.discountAmount > 0) {
        summaryText += `\nالخصم المطبق: -${totals.discountAmount.toFixed(2)}$`;
    }
    summaryText += `\nالإجمالي بعد الخصم: ${totals.discountedTotal.toFixed(2)}$`;
    summaryText += `\nتكلفة التوصيل: ${DELIVERY_CHARGE.toFixed(2)}$`;
    summaryText += `\nالإجمالي النهائي: ${totals.finalTotal.toFixed(2)}$`;
    
    document.getElementById('order-summary-hidden').value = summaryText;
}

function openCheckoutModal() {
    if (cart.length === 0) {
        alert('السلة فارغة. يرجى إضافة منتجات أولاً.');
        return;
    }
    
    updateCheckoutTotals();
    document.getElementById('checkout-modal').style.display = 'block';
}

function closeCheckoutModal() {
    document.getElementById('checkout-modal').style.display = 'none';
}


// =======================================================
// F. وظائف المقاسات (SIZE MODAL)
// =======================================================

let itemToAddToCart = null;

function openSizeModal(item) {
    itemToAddToCart = item;
    const sizeModal = document.getElementById('size-modal');
    const sizeSelect = document.getElementById('size-select');
    
    document.getElementById('size-modal-product-name').textContent = `اختر مقاس ${item.name}`;
    
    sizeSelect.innerHTML = '';
    item.sizes.forEach(size => {
        const option = document.createElement('option');
        option.value = size;
        option.textContent = size;
        sizeSelect.appendChild(option);
    });

    sizeModal.style.display = 'block';
}

function handleSizeConfirmation() {
    if (!itemToAddToCart) return;
    const sizeSelect = document.getElementById('size-select');
    const selectedSize = sizeSelect.value;
    
    addToCart(itemToAddToCart.id, selectedSize);
    itemToAddToCart = null;
}


// =======================================================
// G. إضافة المستمعات للأحداث (EventListeners)
// =======================================================

function setupEventListeners() {
    // 1. زر السلة العائم (للانتقال لقسم السلة)
    document.getElementById('cart-button').onclick = () => {
        const cartSection = document.getElementById('cart');
        if (cartSection) cartSection.scrollIntoView({ behavior: 'smooth' });
    };

    // 2. إغلاق نوافذ الـ modal
    document.querySelector('#checkout-modal .close-btn').onclick = closeCheckoutModal;
    document.querySelector('#size-modal .size-close-btn').onclick = () => document.getElementById('size-modal').style.display = 'none';

    // 3. تأكيد المقاس والإضافة للسلة
    document.getElementById('confirm-size-add').onclick = handleSizeConfirmation;

    // 4. زر تطبيق الخصم
    document.getElementById('apply-promo').onclick = applyPromoCode;

    // 5. التعامل مع إرسال Formspree
    document.getElementById('checkout-form').addEventListener('submit', async function(event) {
        event.preventDefault();
        
        // إظهار رسالة نجاح للعميل
        alert('تم إرسال طلبك بنجاح! سيتم التواصل معك قريباً لتأكيد الطلب.');
        
        // مسح السلة بعد الإرسال الناجح
        cart = [];
        localStorage.removeItem('darfidda_cart');
        updateCartSummary();
        closeCheckoutModal();
        
        // **الخطوة الأهم:** إرسال النموذج فعلياً إلى Formspree (هنا يتم إرساله بعد تحديث الحقول المخفية)
        this.submit(); 
    });
}

// =======================================================
// H. بدء تشغيل التطبيق
// =======================================================

fetchProducts();