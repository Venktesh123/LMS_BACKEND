const express = require("express");
const router = express.Router();
const eventController = require("../controllers/eventController");
const auth = require("../middleware/auth");
const { checkRole } = require("../middleware/roleCheck");

// Get all events
router.get("/", auth, eventController.getAllEvents);

// Get specific event
router.get("/:id", auth, eventController.getEventById);

// Create event (admin only)
router.post("/", auth, checkRole(["admin"]), eventController.createEvent);

// Update event (admin only)
router.put("/:id", auth, checkRole(["admin"]), eventController.updateEvent);

// Delete event (admin only)
router.delete("/:id", auth, checkRole(["admin"]), eventController.deleteEvent);

module.exports = router;
