{
  const box = document.querySelector("#box");
  const btn = document.querySelector("#btn");
  const wrapper = document.querySelector("#page-wrapper");
  /*  */
  btn.addEventListener("click", function (e) {
		btn.classList.toggle("active");
		box.classList.toggle("active");
  });
  /*  */
  wrapper.addEventListener("click", function (e) {
  	if (box.classList.contains("active")) {
  		btn.classList.remove("active");
  		box.classList.remove("active");
  	}
  });
  /*  */
  window.addEventListener("keydown", function (e) {
		if (box.classList.contains("active") && e.keyCode === 27) {
			btn.classList.remove("active");
			box.classList.remove("active");
		}
  });
}
