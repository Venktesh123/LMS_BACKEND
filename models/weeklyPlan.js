const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class WeeklyPlan extends Model {
    static associate(models) {
      WeeklyPlan.belongsTo(models.Course, {
        foreignKey: "courseId",
        as: "course",
      });
    }
  }

  WeeklyPlan.init(
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
      weeks: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
    },
    {
      sequelize,
      modelName: "WeeklyPlan",
    }
  );

  return WeeklyPlan;
};
