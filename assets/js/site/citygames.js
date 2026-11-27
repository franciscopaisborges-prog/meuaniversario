/** Página citygames.html: programa secundário completo. */
import { logVisit } from "../shared/visit.js";
import { renderLists, mountTrailer } from "./games.js";

logVisit("citygames");
renderLists(document);
mountTrailer(document.getElementById("cgPlayer"));
