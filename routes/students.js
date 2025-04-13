const express = require("express");
const router = express.Router();
const studentController = require("../controllers/studentController");
const auth = require("../middleware/auth");
const { checkRole } = require("../middleware/roleCheck");

// Enroll in course
router.post(
  "/courses/:courseId/enroll",
  auth,
  checkRole(["student"]),
  studentController.enrollCourse
);

// Get student details
router.get(
  "/profile",
  auth,
  checkRole(["student"]),
  studentController.getProfile
);

// Get student submissions
router.get(
  "/submissions",
  auth,
  checkRole(["student"]),
  studentController.getSubmissions
);

module.exports = router;
