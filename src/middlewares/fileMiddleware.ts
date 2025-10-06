import multer from "multer";
import fs from "fs";
import path from "path";

const uploadPath = path.resolve(__dirname, "../../tmp");
// Asegúrate de que la carpeta exista
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (_, file, cb) {
    cb(null, uploadPath);
  },
  filename: function (_, file, cb) {
    cb(null, file.originalname);
  },
});
export const uploadFile = multer({ storage: storage });
