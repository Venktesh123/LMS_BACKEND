const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class Assignment extends Model {
    static associate(models) {
      Assignment.belongsTo(models.Course, {
        foreignKey: "courseId",
        as: "course",
      });

      Assignment.hasMany(models.Submission, {
        foreignKey: "assignmentId",
        as: "submissions",
      });
    }
  }

  Assignment.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      courseId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Courses",
          key: "id",
        },
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      dueDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      totalPoints: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      attachments: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
        get() {
          const rawValue = this.getDataValue("attachments");
          return rawValue || [];
        },
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: "Assignment",
      // Add this hook to ensure attachments is always an array
      hooks: {
        beforeValidate: (assignment) => {
          if (!assignment.attachments) {
            assignment.attachments = [];
          }
        },
      },
    }
  );

  return Assignment;
};
