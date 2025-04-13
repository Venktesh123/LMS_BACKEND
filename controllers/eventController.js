const { Event, sequelize } = require("../models");
const { uploadFileToS3 } = require("../utils/s3Helper");

// Get all events
const getAllEvents = async (req, res) => {
  try {
    const events = await Event.findAll({
      order: [["date", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error) {
    console.error("Error in getAllEvents:", error);
    return res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// Get event by ID
const getEventById = async (req, res) => {
  try {
    const event = await Event.findByPk(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        error: "Event not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error("Error in getEventById:", error);
    return res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// Create a new event
const createEvent = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { name, description, date, time, location, link } = req.body;

    // Validate required fields
    if (!name || !date || !time || !location || !link) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error:
          "Please provide all required fields: name, date, time, location, link",
      });
    }

    // Validate link format
    const urlPattern = /^https?:\/\/.+/;
    if (!urlPattern.test(link)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: "Link must be a valid URL starting with http:// or https://",
      });
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
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: "Invalid image type. Allowed types: JPEG, PNG, JPG, GIF",
        });
      }

      // Upload to S3
      try {
        const uploadResult = await uploadFileToS3(imageFile, "events");
        imageUrl = uploadResult.url;
      } catch (uploadError) {
        await transaction.rollback();
        console.error("Error uploading image:", uploadError);
        return res.status(500).json({
          success: false,
          error: "Failed to upload image",
        });
      }
    } else {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: "Event image is required",
      });
    }

    // Create event
    const event = await Event.create(
      {
        name,
        description: description || "",
        date,
        time,
        image: imageUrl,
        location,
        link,
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(201).json({
      success: true,
      data: event,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in createEvent:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        error: messages,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// Update event
const updateEvent = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    // Find the event
    const event = await Event.findByPk(req.params.id, { transaction });

    if (!event) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: "Event not found",
      });
    }

    // Update fields
    const { name, description, date, time, location, link } = req.body;

    if (name) event.name = name;
    if (description !== undefined) event.description = description;
    if (date) event.date = date;
    if (time) event.time = time;
    if (location) event.location = location;

    // Validate link format if provided
    if (link) {
      const urlPattern = /^https?:\/\/.+/;
      if (!urlPattern.test(link)) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: "Link must be a valid URL starting with http:// or https://",
        });
      }
      event.link = link;
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
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: "Invalid image type. Allowed types: JPEG, PNG, JPG, GIF",
        });
      }

      // Upload to S3
      try {
        const uploadResult = await uploadFileToS3(imageFile, "events");
        event.image = uploadResult.url;
      } catch (uploadError) {
        await transaction.rollback();
        console.error("Error uploading image:", uploadError);
        return res.status(500).json({
          success: false,
          error: "Failed to upload image",
        });
      }
    }

    await event.save({ transaction });
    await transaction.commit();

    return res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in updateEvent:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        error: messages,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// Delete event
const deleteEvent = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const event = await Event.findByPk(req.params.id, { transaction });

    if (!event) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: "Event not found",
      });
    }

    // Delete image from S3 if needed
    // This would require tracking the S3 key, not just the URL
    // You could implement a separate field for the S3 key in your Event model

    await event.destroy({ transaction });
    await transaction.commit();

    return res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in deleteEvent:", error);
    return res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

module.exports = {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
};
