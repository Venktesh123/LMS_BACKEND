const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class CourseSyllabus extends Model {
    static associate(models) {
      CourseSyllabus.belongsTo(models.Course, {
        foreignKey: "courseId",
        as: "course",
      });
    }
  }

  CourseSyllabus.init(
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
      modules: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
    },
    {
      sequelize,
      modelName: "CourseSyllabus",
    }
  );

  return CourseSyllabus;
};
