const { Semester, Course } = require("../models");

// Create a new semester
const createSemester = async (req, res) => {
  try {
    const { name, startDate, endDate } = req.body;

    // Validate required fields
    if (!name || !startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "Name, start date, and end date are required" });
    }

    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return res
        .status(400)
        .json({ error: "End date must be after start date" });
    }

    // Create the semester
    const semester = await Semester.create({
      name,
      startDate: start,
      endDate: end,
    });

    return res.status(201).json(semester);
  } catch (error) {
    console.error("Error in createSemester:", error);
    return res.status(400).json({ error: error.message });
  }
};

// Get all semesters
const getAllSemesters = async (req, res) => {
  try {
    // Get all semesters and count their courses
    const semesters = await Semester.findAll({
      include: [
        {
          model: Course,
          as: "courses",
          attributes: ["id"],
        },
      ],
      order: [["startDate", "DESC"]],
    });

    // Format the response
    const formattedSemesters = semesters.map((semester) => ({
      id: semester.id,
      name: semester.name,
      startDate: semester.startDate,
      endDate: semester.endDate,
      courseCount: semester.courses ? semester.courses.length : 0,
      createdAt: semester.createdAt,
      updatedAt: semester.updatedAt,
    }));

    return res.json(formattedSemesters);
  } catch (error) {
    console.error("Error in getAllSemesters:", error);
    return res.status(400).json({ error: error.message });
  }
};

// Get a specific semester by ID
const getSemesterById = async (req, res) => {
  try {
    const { semesterId } = req.params;

    const semester = await Semester.findByPk(semesterId, {
      include: [
        {
          model: Course,
          as: "courses",
          attributes: ["id", "title", "aboutCourse"],
        },
      ],
    });

    if (!semester) {
      return res.status(404).json({ error: "Semester not found" });
    }

    return res.json(semester);
  } catch (error) {
    console.error("Error in getSemesterById:", error);
    return res.status(400).json({ error: error.message });
  }
};

// Update a semester
const updateSemester = async (req, res) => {
  try {
    const { semesterId } = req.params;
    const { name, startDate, endDate } = req.body;

    const semester = await Semester.findByPk(semesterId);
    if (!semester) {
      return res.status(404).json({ error: "Semester not found" });
    }

    // Validate date range if both dates are provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start >= end) {
        return res
          .status(400)
          .json({ error: "End date must be after start date" });
      }
    }

    // Update fields
    if (name) semester.name = name;
    if (startDate) semester.startDate = new Date(startDate);
    if (endDate) semester.endDate = new Date(endDate);

    await semester.save();

    return res.json(semester);
  } catch (error) {
    console.error("Error in updateSemester:", error);
    return res.status(400).json({ error: error.message });
  }
};

// Delete a semester
const deleteSemester = async (req, res) => {
  try {
    const { semesterId } = req.params;

    const semester = await Semester.findByPk(semesterId, {
      include: [
        {
          model: Course,
          as: "courses",
          attributes: ["id"],
        },
      ],
    });

    if (!semester) {
      return res.status(404).json({ error: "Semester not found" });
    }

    // Check if semester has associated courses
    if (semester.courses && semester.courses.length > 0) {
      return res.status(400).json({
        error: "Cannot delete semester that has associated courses",
        courseCount: semester.courses.length,
      });
    }

    await semester.destroy();

    return res.json({ message: "Semester deleted successfully" });
  } catch (error) {
    console.error("Error in deleteSemester:", error);
    return res.status(400).json({ error: error.message });
  }
};

module.exports = {
  createSemester,
  getAllSemesters,
  getSemesterById,
  updateSemester,
  deleteSemester,
};
