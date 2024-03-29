const userModel = require("../models/userModel");
const {
    addUserValidation,
    updateUserValidation,
    passwordValidation,
} = require("../utils/userValidation");
const bcrypt = require("bcryptjs");
require("dotenv/config");

// Controller to add a new user
async function addUserController(req, res) {
    // Retrieve data from the request
    const { username, role } = req.body;
    const addedBy = req.user ? req.user.userId : null;

    try {
        // Check if data is valid
        const { error } = addUserValidation(req.body);
        if (error)
            return res.status(400).json({ message: error.details[0].message });

        if (role === "superadmin" && req.user.role !== "superadmin")
            return res
                .status(400)
                .json({ message: "Accès refusé ! Impossible d'ajouter le superadministrateur." });

        // Check if the username is already taken
        const existingUser = await userModel.findOne({ username: username });
        if (existingUser)
            return res
                .status(400)
                .json({ message: "Nom d'utilisateur déjà existant." });

        // Hash the password
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync("Jesus123!", salt);

        // Create a new user document
        const newUser = new userModel({
            username: username,
            password: hashedPassword,
            role: role,
            added_by: addedBy,
            modified_by: addedBy,
        });

        // Save the document to the database
        await newUser.save();

        res.status(201).json({ message: "Utilisateur créé avec succès." });
    } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

// Controller to get a list of users
async function getUsersController(req, res) {
    try {
        // Retrieve all users from the database
        const allUsers = await userModel
            .find({ deleted: false }, "-password")
            .populate([
                { path: "added_by", select: "username" },
                { path: "modified_by", select: "username" },
            ])
            .sort({ createdAt: -1 });

        res.status(200).send({ users: allUsers });
    } catch (error) {
        console.error("Error getting all users:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

// Controller to search users by username and role
async function searchUsersController(req, res) {
    const { query } = req.query;
    try {
        // Build the search query
        const searchQuery = {
            deleted: false,
            $or: [
                { username: { $regex: query, $options: "i" } },
                { role: { $regex: query, $options: "i" } },
            ],
        };

        // Search for users by username or role
        const searchResults = await userModel
            .find(searchQuery, "-password")
            .populate([
                { path: "added_by", select: "username" },
                { path: "modified_by", select: "username" },
            ]);

        res.status(200).send({ users: searchResults });
    } catch (error) {
        console.error("Error searching users:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

// Controller to get a user by _id
async function getUserController(req, res) {
    // Retrieve the id from the request params
    const { id } = req.params;

    try {
        const user = await userModel
            .findById({ _id: id, deleted: false }, "-password")
            .populate([
                { path: "added_by", select: "username" },
                { path: "modified_by", select: "username" },
            ]);

        res.status(200).send(user);
    } catch (error) {
        console.error("Error getting the user:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

// Controller to update a user
async function updateUserController(req, res) {
    // Retrieve data from the request
    const { username, password, role } = req.body;
    const addedBy = req.user.userId;
    const { id } = req.params;

    try {
        // Check if data is valid
        const { error } = updateUserValidation(req.body);
        if (error)
            return res.status(400).json({ message: error.details[0].message });

        // Check if the username is already taken
        let existingUser = null;
        if (username) {
            existingUser = await userModel.findOne({ username: username });
            if (existingUser && existingUser.username !== username)
                return res.status(400).json({
                    message: "Username already Nom d'utilisateur déjà existant.",
                });
        }

        // Hash the password
        let hashedPassword = null;
        if (password) {
            const salt = bcrypt.genSaltSync(10);
            hashedPassword = bcrypt.hashSync(password, salt);
        }

        // Find the user to update
        const userToUpdate = await userModel.findById(id);

        // Check if the user exists
        if (!userToUpdate) {
            return res.status(404).json({ message: "Utilisateur non trouvé." });
        }

        if (role === "superadmin" && req.user.role !== "superadmin")
            return res.status(404).json({
                message: "Accès refusé. Privilèges de superadmin requis.",
            });

        if (userToUpdate.role === "admin" && req.user.role !== "superadmin" && userToUpdate._id.toString() !== addedBy) {
            return res.status(404).json({
                message:
                    "Accès refusé ! Impossible de modifier un utilisateur administrateur.",
            });
        }

        if (userToUpdate.role === "superadmin" && req.user.role !== "superadmin") {
            return res.status(404).json({
                message:
                    "Accès refusé ! Impossible de modifier le superadministrateur.",
            });
        }


        // Update the document to the database
        await userToUpdate.updateOne({
            username: username ? username : userToUpdate.username,
            password: password ? hashedPassword : userToUpdate.password,
            role: role ? role : userToUpdate.role,
            added_by: addedBy,
            modified_by: addedBy,
        });

        res.status(200).json({ message: "Utilisateur mis à jour avec succès." });
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

// Controller to delete a user
async function deleteUserController(req, res) {
    // Retrieve the id from the request params
    const { id } = req.params;

    try {
        // Check if the user with the given id is an admin and if the requester is a superadmin before deleting
        const userToDelete = await userModel.findById(id, {
            deleted: true,
            role: 1,
        });

        if (userToDelete.role === "admin" && req.user.role !== "superadmin") {
            return res.status(404).json({
                message:
                    "Accès refusé ! Impossible de supprimer un utilisateur administrateur.",
            });
        }

        if (userToDelete.role === "superadmin" && req.user.role !== "superadmin") {
            return res.status(404).json({
                message:
                    "Accès refusé ! Impossible de supprimer le superadministrateur.",
            });
        }

        await userToDelete.updateOne({ deleted: true });
        res.status(200).send({ message: "Utilisateur supprimé avec succès." });
    } catch (error) {
        console.error("Error getting the user:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

// Controller to change password
async function changePasswordController(req, res) {
    // Retrieve data from the request
    const { currentPassword, newPassword: password } = req.body;
    const addedBy = req.user.userId;

    try {
        // Check if data is valid
        const { error } = passwordValidation({ password });
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        const userToUpdate = await userModel.findById(addedBy);
        if (!userToUpdate) {
            return res.status(404).json({ message: "Utilisateur non trouvé." });
        }

        if (userToUpdate && userToUpdate._id.toString() !== addedBy) {
            return res.status(404).json({ message: "Accès refusé!" });
        }

        // Compare the provided current password with the stored hashed password
        const isCurrentPasswordValid = bcrypt.compareSync(currentPassword, userToUpdate.password);

        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                message: "Mot de passe actuel incorrect."
            });
        }

        // Hash the password
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(password, salt);

        // Update the document to the database
        await userToUpdate.updateOne({
            password: hashedPassword,
            added_by: addedBy,
            modified_by: addedBy,
        });

        res.status(200).json({ message: "Mot de passe changé avec succès." });
    } catch (error) {
        console.error("Error changing password:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

module.exports = {
    addUserController,
    getUsersController,
    getUserController,
    updateUserController,
    deleteUserController,
    searchUsersController,
    changePasswordController,
};
