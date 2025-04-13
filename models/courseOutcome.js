const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class CourseOutcome extends Model {
    static associate(models) {
      CourseOutcome.belongsTo(models.Course, {
        foreignKey: "courseId",
        as: "course",
      });
    }
  }

  CourseOutcome.init(
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
      outcomes: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
    },
    {
      sequelize,
      modelName: "CourseOutcome",
    }
  );

  return CourseOutcome;
};
