const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class Teacher extends Model {
    static associate(models) {
      Teacher.belongsTo(models.User, {
        foreignKey: "userId",
        as: "user",
      });

      Teacher.hasMany(models.Course, {
        foreignKey: "teacherId",
        as: "courses",
      });

      Teacher.hasMany(models.Student, {
        foreignKey: "teacherId",
        as: "students",
      });
    }
  }

  Teacher.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "Teacher",
    }
  );

  return Teacher;
};
