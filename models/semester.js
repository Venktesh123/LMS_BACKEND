const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class Semester extends Model {
    static associate(models) {
      Semester.hasMany(models.Course, {
        foreignKey: "semesterId",
        as: "courses",
      });
    }
  }

  Semester.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      startDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      endDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "Semester",
    }
  );

  return Semester;
};
