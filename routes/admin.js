const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const auth = require("../middleware/auth");
const { checkRole } = require("../middleware/roleCheck");
const uploadMiddleware = require("../middleware/upload");

// Test route
router.get("/test", (req, res) => {
  res.json({ message: "Admin routes working" });
});

// Upload users route
router.post(
  "/upload-users",
  auth,
  checkRole(["admin"]),
  uploadMiddleware,
  adminController.uploadUsers
);

// Get my students (for teacher)
router.get(
  "/my-students",
  auth,
  checkRole(["teacher"]),
  adminController.getMyStudents
);

// Get students by teacher ID (admin route)
router.get(
  "/teacher/:teacherId/students",
  auth,
  checkRole(["admin", "teacher"]),
  adminController.getStudentsByTeacherId
);

module.exports = router;
