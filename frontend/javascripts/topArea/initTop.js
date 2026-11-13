function init(){
    // 頂層「主頁按鈕」：點擊回到 index.html
  const homeButton = document.getElementById("to-home");
  if (homeButton) {
    homeButton.addEventListener("click", () => {
      window.location.assign("./index.html");
    });
  }

  // 頂層「刊登商品按鈕」：點擊跳轉至 addProducts.html
  const addButton = document.getElementById("list-products-button");
  if (addButton) {
    addButton.addEventListener("click", () => {
      window.location.assign("./addProducts.html");
    });
  }

  // 頂層「會員按鈕」：若已登入（登出按鈕可見），點擊跳轉至 selfPage.html
  const userButton = document.getElementById("user-button");
  const logoutButton = document.getElementById("logout-button");
  if (userButton) {
    userButton.addEventListener("click", () => {
      if (logoutButton && !logoutButton.hidden) {
        window.location.assign("./selfPage.html");
      }
    });
  }
}

window.addEventListener("load", init);