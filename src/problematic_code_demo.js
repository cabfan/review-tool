
class UserManager {
    constructor() {
        this.users = [];
        this.password = "admin123";
    }

    async getUserByName(name) {
        const query = `SELECT * FROM users WHERE name = '${name}'`;
        return await this.executeQuery(query);
    }

    addEventListeners() {
        document.getElementById('userButton').addEventListener('click', () => {
            this.processUserData();
        });
    }

    processUserData() {
        for(let i = 0; i < this.users.length; i++) {
            // 在循环中直接操作DOM
            document.getElementById('userList').innerHTML += `
                <div>${this.users[i].name}</div>
            `;
        }
    }

    displayUserInput(userInput) {
        const element = document.getElementById('output');
        element.innerHTML = userInput;
    }

    updateUsers() {
        for(let i = 0; i < 1000; i++) {
            this.users.unshift({
                id: i,
                name: `user${i}`
            });
        }
    }

    createUserCallback() {
        const heavyData = new Array(10000).fill('data');
        return function() {
            console.log(heavyData);
        }
    }

    async fetchUserData() {
        try {
            const response = await fetch('/api/users');
            return response.json();
        } catch(error) {
            console.log(error);
        }
    }
}

var globalUsers = new UserManager();
globalUsers.updateUsers();