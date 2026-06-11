(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/props/props-form-utils.js");

  P.propsAddNote = function (text) {
    const p = document.createElement("p");
    p.style.gridColumn = "1 / -1";
    p.style.margin = "0 0 0.35rem";
    p.style.fontSize = "0.88rem";
    p.style.color = "var(--muted)";
    p.textContent = text;
    P.propsForm.appendChild(p);
  };

  P.propsAddNum = function (label, id, val, onChange) {
    const l = document.createElement("label");
    l.htmlFor = id;
    l.textContent = label;
    const inp = document.createElement("input");
    inp.type = "number";
    inp.id = id;
    inp.step = "0.1";
    inp.value = val;
    inp.addEventListener("change", onChange);
    P.propsForm.appendChild(l);
    P.propsForm.appendChild(inp);
  };
})();
