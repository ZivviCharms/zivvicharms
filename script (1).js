// app.js — drop-in replacement (ES6 module friendly, no globals)
(() => {
  /* CONFIG */
  const STORAGE_KEYS = { STOCK: "zv_stock", CART: "zv_cart", WISH: "zv_wish" };

  /* Utilities */
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  /* Load initial DOM product data -> build stock map */
  const products = $$(".product").map(p => {
    const id = p.dataset.id || (p.dataset.name && p.dataset.name.replace(/\s+/g,'-').toLowerCase());
    p.dataset.id = id;
    return {
      id,
      el: p,
      name: p.dataset.name || p.querySelector("h3, h2")?.textContent?.trim() || "Item",
      price: Number(p.dataset.price) || parseInt(p.querySelector(".price")?.textContent?.replace(/[^0-9]/g,'')) || 0,
      qty: Number(p.dataset.qty) || Number(p.querySelector(".stock")?.textContent?.replace(/[^0-9]/g,'')) || 0,
      category: p.dataset.category || ""
    };
  });

  /* State */
  const state = {
    stock: load(STORAGE_KEYS.STOCK) || products.reduce((s,p)=>{ s[p.id]=p.qty; return s; }, {}),
    cart: load(STORAGE_KEYS.CART) || [],
    wish: load(STORAGE_KEYS.WISH) || []
  };

  function saveAll(){ localStorage.setItem(STORAGE_KEYS.STOCK, JSON.stringify(state.stock)); localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(state.cart)); localStorage.setItem(STORAGE_KEYS.WISH, JSON.stringify(state.wish)); }

  /* UI references */
  const cartToggleBtn = $(".icon[onclick*='toggleCart']") || $(".icon[href='#cart']");
  const wishToggleBtn = $(".icon[onclick*='toggleWishlist']") || $(".icon[href='#wish']");
  const cartBox = $("#cart") || document.createElement("div");
  const wishBox = $("#wishlist") || document.createElement("div");

  /* Render helpers */
  function updateProductUI(pid){
    const prod = products.find(p=>p.id===pid);
    if(!prod) return;
    const qty = state.stock[pid] ?? 0;
    const stockEl = prod.el.querySelector(".stock") || prod.el.querySelector(".qty");
    if(stockEl) stockEl.textContent = `Available: ${qty}`;
    const btn = prod.el.querySelector("button");
    if(btn) {
      btn.disabled = qty === 0;
      btn.textContent = qty === 0 ? "Sold Out" : "Add to Cart";
    }
  }

  function renderAllProducts(){ products.forEach(p=>updateProductUI(p.id)); }

  function renderCart(){
    const list = $("#cart-items");
    if(!list) return;
    list.innerHTML = "";
    let total = 0;
    state.cart.forEach((item, idx) => {
      total += item.price * item.qty;
      const li = document.createElement("li");
      li.innerHTML = `
        ${item.name} - ₹${item.price} × ${item.qty}
        <div>
          <button class="inc" data-index="${idx}">➕</button>
          <button class="dec" data-index="${idx}">➖</button>
          <button class="rem" data-index="${idx}">❌</button>
        </div>
      `;
      list.appendChild(li);
    });
    const totalEl = $("#cart-total");
    if(totalEl) totalEl.textContent = `Total: ₹${total}`;
    // Also keep hidden form fields in sync
    const cartData = $("#cart-data");
    const totalData = $("#cart-total-data");
    if(cartData) cartData.value = state.cart.map(i=>`${i.name} x${i.qty} = ₹${i.price*i.qty}`).join(", ");
    if(totalData) totalData.value = total;
  }

  function renderWishlist(){
    const list = $("#wishlist-items");
    if(!list) return;
    list.innerHTML = "";
    state.wish.forEach(w => {
      const li = document.createElement("li");
      li.textContent = `${w.name} - ₹${w.price}`;
      list.appendChild(li);
    });
  }

  /* Cart operations */
  function addToCartById(id){
    if((state.stock[id] || 0) <= 0) { alert("Out of stock!"); return; }
    let it = state.cart.find(x=>x.id===id);
    if(it) it.qty += 1;
    else {
      const p = products.find(x=>x.id===id);
      state.cart.push({ id, name: p.name, price: p.price, qty: 1});
    }
    state.stock[id] -= 1;
    saveAll(); updateProductUI(id); renderCart();
  }

  function updateQtyInCart(index, delta){
    const item = state.cart[index];
    if(!item) return;
    if(delta > 0){
      if((state.stock[item.id] || 0) <= 0) return alert("No more stock");
      item.qty += 1;
      state.stock[item.id] -= 1;
    } else {
      item.qty -= 1;
      state.stock[item.id] += 1;
      if(item.qty <= 0) state.cart.splice(index,1);
    }
    saveAll(); renderCart(); updateProductUI(item.id);
  }

  function removeCartItem(index){
    const item = state.cart[index];
    if(!item) return;
    state.stock[item.id] += item.qty;
    state.cart.splice(index,1);
    saveAll(); renderCart(); updateProductUI(item.id);
  }

  /* Wishlist */
  function toggleWishlistItemById(id){
    const existingIdx = state.wish.findIndex(x => x.id === id);
    if(existingIdx === -1){
      const p = products.find(x=>x.id===id);
      state.wish.push({id, name: p.name, price: p.price});
    } else {
      state.wish.splice(existingIdx,1);
    }
    saveAll(); renderWishlist();
    // update heart icon visually
    const prodEl = document.querySelector(`.product[data-id="${id}"]`);
    const btn = prodEl?.querySelector(".wishlist-btn");
    if(btn) btn.textContent = state.wish.some(w=>w.id===id) ? "❤️" : "🤍";
  }

  /* Event delegation */
  document.addEventListener("click", (e) => {
    const addBtn = e.target.closest(".add-to-cart, .buy-btn, button[data-action='add-to-cart']");
    if(addBtn){
      const prod = addBtn.closest(".product");
      if(prod) addToCartById(prod.dataset.id);
      return;
    }

    const inc = e.target.closest("#cart-items .inc");
    if(inc) { updateQtyInCart(Number(inc.dataset.index), +1); return; }
    const dec = e.target.closest("#cart-items .dec");
    if(dec) { updateQtyInCart(Number(dec.dataset.index), -1); return; }
    const rem = e.target.closest("#cart-items .rem");
    if(rem) { removeCartItem(Number(rem.dataset.index)); return; }

    const wishBtn = e.target.closest(".wishlist-btn");
    if(wishBtn){
      const prod = wishBtn.closest(".product");
      if(prod) toggleWishlistItemById(prod.dataset.id);
      return;
    }

    // cart/wishlist toggles (if you have dedicated elements)
    if(e.target.matches(".icon.cart-toggle")) {
      cartBox.style.display = cartBox.style.display === "block" ? "none" : "block";
      wishBox.style.display = "none";
    }
    if(e.target.matches(".icon.wish-toggle")) {
      wishBox.style.display = wishBox.style.display === "block" ? "none" : "block";
      cartBox.style.display = "none";
    }
  });

  /* Form submit integration: prepare hidden inputs before submit */
  const orderForm = document.getElementById("orderForm");
  if(orderForm){
    orderForm.addEventListener("submit", (ev) => {
      // update hidden fields (also keep real validation on server)
      const cartData = document.getElementById("cart-data");
      const totalData = document.getElementById("cart-total-data");
      cartData && (cartData.value = state.cart.map(i=>`${i.name} x${i.qty} = ₹${i.price*i.qty}`).join(", "));
      totalData && (totalData.value = state.cart.reduce((s,i)=>s+i.qty*i.price,0));
      // allow normal submit to Formspree
    });
  }

  /* Init render */
  renderAllProducts(); renderCart(); renderWishlist();
})();
