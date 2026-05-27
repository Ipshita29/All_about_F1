const getCircuit = async (req, res) => {
    try {
        const response = await fetch("https://api.jolpi.ca/ergast/f1/2026/circuits.json")
        const data = await response.json();
        res.json(
            data.MRData.CircuitTable.Circuits
        )
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch circuits data" })
    }
}

module.exports = {
    getCircuit
}