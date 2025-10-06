import axios from "axios"
import { BACKEND_API } from "../config/config"

export const getUserByPhone = async (phoneNumber: string) => {
    return await axios.get(`${BACKEND_API}${phoneNumber}`)
}