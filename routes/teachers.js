const express = require("express");
const router = express.Router();
const teacherController = require("../controllers/teacherController");
const auth = require("../middleware/auth");
const { checkRole } = require("../middleware/roleCheck");

// Get teacher profile
router.get(
  "/profile",
  auth,
  checkRole(["teacher"]),
  teacherController.getProfile
);

// Get teacher's students
router.get(
  "/students",
  auth,
  checkRole(["teacher"]),
  teacherController.getStudents
);

// Assign student to teacher (admin only)
router.post(
  "/students/:studentId/assign",
  auth,
  checkRole(["admin"]),
  teacherController.assignStudent
);

module.exports = router;
