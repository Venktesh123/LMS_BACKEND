const express = require("express");
const router = express.Router();
const semesterController = require("../controllers/semesterController");
const auth = require("../middleware/auth");
const { checkRole } = require("../middleware/roleCheck");

// Get all semesters
router.get("/", auth, semesterController.getAllSemesters);

// Create semester (admin only)
router.post("/", auth, checkRole(["admin"]), semesterController.createSemester);

module.exports = router;
