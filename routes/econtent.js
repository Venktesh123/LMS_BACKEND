const express = require("express");
const router = express.Router();
const econtentController = require("../controllers/econtentController");
const auth = require("../middleware/auth");
const { checkRole } = require("../middleware/roleCheck");

// Create new e-content module
router.post(
  "/course/:courseId/econtent",
  auth,
  checkRole(["teacher"]),
  econtentController.createEContent
);

// Get e-content for a course
router.get(
  "/course/:courseId/econtent",
  auth,
  econtentController.getEContentByCourse
);

// Get specific module
router.get(
  "/course/:courseId/econtent/module/:moduleId",
  auth,
  econtentController.getModuleById
);

// Update module
router.put(
  "/course/:courseId/econtent/module/:moduleId",
  auth,
  checkRole(["teacher"]),
  econtentController.updateModule
);

// Delete module
router.delete(
  "/course/:courseId/econtent/module/:moduleId",
  auth,
  checkRole(["teacher"]),
  econtentController.deleteModule
);

// Delete file from module
router.delete(
  "/course/:courseId/econtent/module/:moduleId/file/:fileId",
  auth,
  checkRole(["teacher"]),
  econtentController.deleteFile
);

module.exports = router;
