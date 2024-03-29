const userModel = require("../models/userModel");
const projectModel = require("../models/projectModel");

// Controller to get statistics about users and projects
async function getStatisticsController(req, res) {
  try {
    // Retrieve the number of users from the database
    const numberOfUsers = await userModel.countDocuments({ deleted: false });

    // Retrieve the number of projects from the database
    const numberOfProjects = await projectModel.countDocuments({
      deleted: false,
    });

    const statistics = {
      users: numberOfUsers,
      projects: numberOfProjects,
    };

    res.status(200).json({ statistics: statistics });
  } catch (error) {
    console.error("Error retrieving statistics:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = { getStatisticsController };
