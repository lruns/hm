package ru.neyvan.hm.terms;

import com.badlogic.gdx.utils.Json;
/**
 * Created by AndyGo on 08.01.2018.
 */

public abstract class Term  {
    private int ID; //byte 097-122
    public Term(){this.ID = 97;}
    public Term(int ID){
        this.ID = ID;
    }
    public int getID(){
        return ID;
    }
    public abstract boolean checkCondition(int numberToCheck);
}
