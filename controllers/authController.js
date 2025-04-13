// controllers/authController.js
const jwt = require("jsonwebtoken");
const { User, Teacher, Student, sequelize } = require("../models");
const config = require("../config/config");

// Register new user
const register = async (req, res) => {
  try {
    const { name, email, password, role, teacherEmail } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // Create user transaction
    const result = await sequelize.transaction(async (t) => {
      // Create user
      const user = await User.create(
        {
          name,
          email,
          password,
          role,
        },
        { transaction: t }
      );

      // Create profile based on role
      if (role === "teacher") {
        await Teacher.create(
          {
            userId: user.id,
            email: email.toLowerCase(),
          },
          { transaction: t }
        );
      } else if (role === "student") {
        // Find teacher by email
        const teacher = await Teacher.findOne({
          where: { email: teacherEmail.toLowerCase() },
          transaction: t,
        });

        if (!teacher) {
          throw new Error(`Teacher with email ${teacherEmail} not found`);
        }

        await Student.create(
          {
            userId: user.id,
            teacherId: teacher.id,
            teacherEmail: teacherEmail.toLowerCase(),
          },
          { transaction: t }
        );
      }

      return user;
    });

    // Generate JWT token
    const token = jwt.sign(
      { id: result.id },
      process.env.JWT_SECRET || config.jwt.secret,
      {
        expiresIn: config.jwt.expiresIn,
      }
    );

    return res.status(201).json({
      user: {
        id: result.id,
        name: result.name,
        email: result.email,
        role: result.role,
      },
      token,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(400).json({ error: error.message });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Validate password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET || config.jwt.secret,
      {
        expiresIn: config.jwt.expiresIn,
      }
    );

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(400).json({ error: error.message });
  }
};

// Get current authenticated user
const getCurrentUser = async (req, res) => {
  try {
    // User should be available from the auth middleware
    const userId = req.user.id;

    // Fetch the user with appropriate profile details
    const user = await User.findByPk(userId, {
      attributes: { exclude: ["password"] },
      include: [
        // Include teacher details if user is a teacher
        {
          model: Teacher,
          as: "teacher",
          required: false,
        },
        // Include student details if user is a student
        {
          model: Student,
          as: "student",
          required: false,
          include: [
            {
              model: Teacher,
              as: "teacher",
              include: [{ model: User, attributes: ["name", "email"] }],
            },
          ],
        },
      ],
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Return the user details
    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        // Include relevant profile data based on role
        ...(user.teacher ? { teacher: user.teacher } : {}),
        ...(user.student ? { student: user.student } : {}),
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
};
