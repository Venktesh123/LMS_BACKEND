const express = require("express");
const router = express.Router();
const assignmentController = require("../controllers/assignmentController");
const auth = require("../middleware/auth");
const { checkRole } = require("../middleware/roleCheck");

// Create assignment (teacher only)
router.post(
  "/courses/:courseId/assignments",
  auth,
  checkRole(["teacher"]),
  assignmentController.createAssignment
);

// Get all assignments for a course
router.get(
  "/courses/:courseId/assignments",
  auth,
  assignmentController.getCourseAssignments
);

// Get specific assignment
router.get(
  "/assignments/:assignmentId",
  auth,
  assignmentController.getAssignmentById
);

// Update assignment (teacher only)
router.put(
  "/assignments/:assignmentId",
  auth,
  checkRole(["teacher"]),
  assignmentController.updateAssignment
);

// Delete assignment (teacher only)
router.delete(
  "/assignments/:assignmentId",
  auth,
  checkRole(["teacher"]),
  assignmentController.deleteAssignment
);

// Submit assignment (student only)
router.post(
  "/assignments/:assignmentId/submit",
  auth,
  checkRole(["student"]),
  assignmentController.submitAssignment
);

// Grade submission (teacher only)
router.post(
  "/assignments/:assignmentId/submissions/:submissionId/grade",
  auth,
  checkRole(["teacher"]),
  assignmentController.gradeSubmission
);

module.exports = router;
