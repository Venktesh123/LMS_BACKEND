// controllers/eventController.js
const eventRepository = require("../repository/eventRepository");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { ErrorHandler } = require("../middleware/errorHandler");
const { uploadFileToS3 } = require("../utils/s3Helper");

// Get all events
exports.getAllEvents = catchAsyncErrors(async (req, res, next) => {
  try {
    const events = await eventRepository.findAll();

    return res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error) {
    console.error("Error in getAllEvents:", error);
    return next(new ErrorHandler("Server Error", 500));
  }
});

// Get event by ID
exports.getEventById = catchAsyncErrors(async (req, res, next) => {
  try {
    const event = await eventRepository.findById(req.params.id);

    if (!event) {
      return next(new ErrorHandler("Event not found", 404));
    }

    return res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error("Error in getEventById:", error);
    return next(new ErrorHandler("Server Error", 500));
  }
});

// Create a new event
exports.createEvent = catchAsyncErrors(async (req, res, next) => {
  try {
    const { name, description, date, time, location, link } = req.body;

    // Validate required fields
    if (!name || !date || !time || !location || !link) {
      return next(
        new ErrorHandler(
          "Please provide all required fields: name, date, time, location, link",
          400
        )
      );
    }

    // Validate link format
    const urlPattern = /^https?:\/\/.+/;
    if (!urlPattern.test(link)) {
      return next(
        new ErrorHandler(
          "Link must be a valid URL starting with http:// or https://",
          400
        )
      );
    }

    // Handle image upload
    let imageUrl = null;
    if (req.files && req.files.image) {
      const imageFile = req.files.image;

      // Validate image type
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/jpg",
        "image/gif",
      ];
      if (!allowedTypes.includes(imageFile.mimetype)) {
        return next(
          new ErrorHandler(
            "Invalid image type. Allowed types: JPEG, PNG, JPG, GIF",
            400
          )
        );
      }

      // Upload to S3
      try {
        const uploadResult = await uploadFileToS3(imageFile, "events");
        imageUrl = uploadResult.url;
      } catch (uploadError) {
        console.error("Error uploading image:", uploadError);
        return next(new ErrorHandler("Failed to upload image", 500));
      }
    } else {
      return next(new ErrorHandler("Event image is required", 400));
    }

    // Create event
    const event = await eventRepository.create({
      name,
      description: description || "",
      date,
      time,
      image: imageUrl,
      location,
      link,
    });

    return res.status(201).json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error("Error in createEvent:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return next(new ErrorHandler(messages, 400));
    }

    return next(new ErrorHandler("Server Error", 500));
  }
});

// Update event
exports.updateEvent = catchAsyncErrors(async (req, res, next) => {
  try {
    // Find the event
    const event = await eventRepository.findById(req.params.id);

    if (!event) {
      return next(new ErrorHandler("Event not found", 404));
    }

    // Update fields
    const { name, description, date, time, location, link } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (date) updateData.date = date;
    if (time) updateData.time = time;
    if (location) updateData.location = location;

    // Validate link format if provided
    if (link) {
      const urlPattern = /^https?:\/\/.+/;
      if (!urlPattern.test(link)) {
        return next(
          new ErrorHandler(
            "Link must be a valid URL starting with http:// or https://",
            400
          )
        );
      }
      updateData.link = link;
    }

    // Handle image update if provided
    if (req.files && req.files.image) {
      const imageFile = req.files.image;

      // Validate image type
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/jpg",
        "image/gif",
      ];
      if (!allowedTypes.includes(imageFile.mimetype)) {
        return next(
          new ErrorHandler(
            "Invalid image type. Allowed types: JPEG, PNG, JPG, GIF",
            400
          )
        );
      }

      // Upload to S3
      try {
        const uploadResult = await uploadFileToS3(imageFile, "events");
        updateData.image = uploadResult.url;
      } catch (uploadError) {
        console.error("Error uploading image:", uploadError);
        return next(new ErrorHandler("Failed to upload image", 500));
      }
    }

    // Update the event
    const updatedEvent = await eventRepository.update(event.id, updateData);

    return res.status(200).json({
      success: true,
      data: updatedEvent,
    });
  } catch (error) {
    console.error("Error in updateEvent:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return next(new ErrorHandler(messages, 400));
    }

    return next(new ErrorHandler("Server Error", 500));
  }
});

// Delete event
exports.deleteEvent = catchAsyncErrors(async (req, res, next) => {
  try {
    const event = await eventRepository.findById(req.params.id);

    if (!event) {
      return next(new ErrorHandler("Event not found", 404));
    }

    // Delete the event
    await eventRepository.delete(event.id);

    return res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    console.error("Error in deleteEvent:", error);
    return next(new ErrorHandler("Server Error", 500));
  }
});
